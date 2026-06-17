import { prisma } from '@/lib/db';
import { IngestAd, sanitizeCopy } from '@/lib/validation/ads';
import { computeWinnerScoreFromSignals, classifyAd } from '@/lib/services/scoring';
import { getScoringRules } from '@/lib/services/settings';

export interface IngestResult {
  received: number;
  created: number;
  updated: number;
  errors: { ad_id: string; message: string }[];
}

/**
 * Ingesta un lote de anuncios del spy.
 * - Deduplica por ad_id (upsert): si ya existe, actualiza días/gasto y marca isNew=false.
 * - Calcula Winner Score y clasificación con las reglas vigentes.
 * - Liga la tienda (Store) por nombre+país si existe; si no, la crea.
 *
 * Es idempotente: reingestar el mismo ad_id no duplica filas.
 */
export async function ingestAds(ads: IngestAd[]): Promise<IngestResult> {
  const rules = await getScoringRules();
  const result: IngestResult = { received: ads.length, created: 0, updated: 0, errors: [] };

  for (const ad of ads) {
    try {
      const winnerScore = computeWinnerScoreFromSignals(
        {
          estimatedSpend: ad.estimated_spend,
          daysActive: ad.days_active,
          estimatedImpressions: ad.estimated_impressions,
        },
        rules,
      );
      const classification = classifyAd(winnerScore, ad.days_active, rules);
      const country = ad.country.toUpperCase();

      // Resolver/crear la tienda competidora
      const store = await prisma.store.upsert({
        where: { name_country: { name: ad.store_name, country } },
        create: { name: ad.store_name, country },
        update: {},
      });

      const existing = await prisma.ad.findUnique({ where: { adId: ad.ad_id } });

      await prisma.ad.upsert({
        where: { adId: ad.ad_id },
        create: {
          adId: ad.ad_id,
          storeId: store.id,
          storeName: ad.store_name,
          country,
          adLibraryUrl: ad.ad_library_url,
          copyText: sanitizeCopy(ad.copy_text),
          creativeUrl: ad.creative_url || null,
          daysActive: ad.days_active,
          estimatedSpend: ad.estimated_spend,
          winnerScore,
          classification,
          isNew: true,
          // Un anuncio del Ad Library de `country` se está vendiendo en ese país:
          // si es CO, "se vende en CO". Solo los extranjeros quedan en false y son
          // los que deben aparecer en el filtro "No se vende en CO".
          sellsInColombia: ad.sells_in_colombia ?? country === 'CO',
          // "Creativo extranjero sin usar en CO" solo aplica a anuncios EXTRANJEROS
          // (un creativo que funciona afuera y aún no se usa en CO). Un anuncio CO
          // nunca lo lleva: su creativo ya está en CO.
          hasUnusedForeignCreative: country !== 'CO' && (ad.has_unused_foreign_creative ?? false),
          detectedAt: ad.detected_at ?? new Date(),
          firstSeenAt: ad.detected_at ?? new Date(),
          lastSeenAt: new Date(),
          raw: ad as unknown as object,
        },
        update: {
          // Reingesta: actualizamos métricas y marcamos como histórico (visto antes)
          storeId: store.id,
          adLibraryUrl: ad.ad_library_url,
          copyText: sanitizeCopy(ad.copy_text) ?? undefined,
          creativeUrl: ad.creative_url || undefined,
          daysActive: ad.days_active,
          estimatedSpend: ad.estimated_spend,
          winnerScore,
          classification,
          isNew: false,
          lastSeenAt: new Date(),
        },
      });

      if (existing) result.updated += 1;
      else result.created += 1;
    } catch (err) {
      result.errors.push({
        ad_id: ad.ad_id,
        message: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  }

  return result;
}

/** Recalcula score y clasificación de TODOS los anuncios (tras cambiar reglas). */
export async function recomputeAllAds(): Promise<number> {
  const rules = await getScoringRules();
  const ads = await prisma.ad.findMany();
  let n = 0;
  for (const ad of ads) {
    // Las impresiones (si las hubo) quedaron en el payload original `raw`.
    const raw = ad.raw as { estimated_impressions?: number } | null;
    const winnerScore = computeWinnerScoreFromSignals(
      {
        estimatedSpend: ad.estimatedSpend,
        daysActive: ad.daysActive,
        estimatedImpressions: raw?.estimated_impressions,
      },
      rules,
    );
    const classification = classifyAd(winnerScore, ad.daysActive, rules);
    await prisma.ad.update({ where: { id: ad.id }, data: { winnerScore, classification } });
    n += 1;
  }
  return n;
}

export interface AdFilters {
  classification?: string;
  country?: string;
  onlyNew?: boolean;
  sellsInColombia?: boolean;
  hasUnusedForeignCreative?: boolean;
  minDaysActive?: number;
  search?: string;
  sortBy?: 'winnerScore' | 'daysActive' | 'estimatedSpend' | 'detectedAt';
  sortDir?: 'asc' | 'desc';
  /** Página (1-based) para paginación server-side. */
  page?: number;
  /** Tamaño de página (por defecto 50, máx. 200). */
  pageSize?: number;
}

/** Lista anuncios aplicando filtros del negocio, orden y paginación. */
export async function listAds(filters: AdFilters = {}) {
  const where: Record<string, unknown> = {};
  if (filters.classification) where.classification = filters.classification;
  if (filters.country) where.country = filters.country.toUpperCase();
  if (filters.onlyNew) where.isNew = true;
  if (typeof filters.sellsInColombia === 'boolean') where.sellsInColombia = filters.sellsInColombia;
  if (typeof filters.hasUnusedForeignCreative === 'boolean')
    where.hasUnusedForeignCreative = filters.hasUnusedForeignCreative;
  if (typeof filters.minDaysActive === 'number') where.daysActive = { gte: filters.minDaysActive };
  if (filters.search) {
    where.OR = [
      { storeName: { contains: filters.search, mode: 'insensitive' } },
      { copyText: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  const sortBy = filters.sortBy ?? 'winnerScore';
  const sortDir = filters.sortDir ?? 'desc';

  // Orden determinista: tras la clave elegida, desempata por las otras señales y
  // por id. Evita que muchos anuncios con el mismo Winner Score (p. ej. sin gasto)
  // salgan en orden arbitrario y cambiante entre recargas.
  const tiebreakers = (['winnerScore', 'daysActive', 'estimatedSpend', 'detectedAt'] as const)
    .filter((k) => k !== sortBy)
    .map((k) => ({ [k]: 'desc' as const }));
  const orderBy = [{ [sortBy]: sortDir }, ...tiebreakers, { id: 'desc' as const }];

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(filters.pageSize ?? 50)));

  const [ads, total] = await prisma.$transaction([
    prisma.ad.findMany({
      where,
      orderBy,
      include: { store: true, product: true },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ad.count({ where }),
  ]);

  return { ads, total, page, pageSize };
}
