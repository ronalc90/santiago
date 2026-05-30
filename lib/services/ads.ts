import { prisma } from '@/lib/db';
import { IngestAd } from '@/lib/validation/ads';
import { computeWinnerScore, classifyAd } from '@/lib/services/scoring';
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
      const winnerScore = computeWinnerScore(ad.estimated_spend, ad.days_active);
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
          copyText: ad.copy_text || null,
          creativeUrl: ad.creative_url || null,
          daysActive: ad.days_active,
          estimatedSpend: ad.estimated_spend,
          winnerScore,
          classification,
          isNew: true,
          sellsInColombia: ad.sells_in_colombia ?? false,
          hasUnusedForeignCreative: ad.has_unused_foreign_creative ?? false,
          detectedAt: ad.detected_at ?? new Date(),
          firstSeenAt: ad.detected_at ?? new Date(),
          lastSeenAt: new Date(),
          raw: ad as unknown as object,
        },
        update: {
          // Reingesta: actualizamos métricas y marcamos como histórico (visto antes)
          storeId: store.id,
          adLibraryUrl: ad.ad_library_url,
          copyText: ad.copy_text || undefined,
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
    const winnerScore = computeWinnerScore(ad.estimatedSpend, ad.daysActive);
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
}

/** Lista anuncios aplicando filtros del negocio y orden. */
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

  return prisma.ad.findMany({
    where,
    orderBy: { [sortBy]: sortDir },
    include: { store: true, product: true },
    take: 500,
  });
}
