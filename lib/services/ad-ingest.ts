import { prisma } from '@/lib/db';
import { getAdSource, FetchAdsInput, RawAd } from '@/lib/ad-sources';
import { persistCreative, PersistedCreative, CreativeKind } from '@/lib/services/creative';
import { ingestAds, IngestResult } from '@/lib/services/ads';
import { IngestAd } from '@/lib/validation/ads';

/**
 * Orquesta la ingesta de anuncios REALES (capa de servicio):
 *   fuente (Apify) → descargar y re-hospedar el creativo → mapear → ingestAds().
 *
 * Reutiliza ingestAds() (upsert idempotente por ad_id, score y clasificación),
 * así que la deduplicación y el scoring siguen viviendo en un solo lugar.
 */

const CREATIVE_CONCURRENCY = 5;

export interface AdIngestSummary {
  fetched: number;
  withCreative: number;
  reused: number;
  creativeErrors: number;
  ingest: IngestResult;
}

export async function runAdIngest(input: FetchAdsInput): Promise<AdIngestSummary> {
  const rawAds = await getAdSource().fetchAds(input);

  // Anuncios que YA tienen creativo hospedado: no re-descargar ni re-comprimir
  // en cada corrida del cron (ahorra CPU, ancho de banda y requests de storage).
  const existing = await prisma.ad.findMany({
    where: { adId: { in: rawAds.map((r) => r.adId) }, creativeUrl: { not: null } },
    select: { adId: true, creativeUrl: true },
  });
  const existingCreative = new Map(existing.map((e) => [e.adId, e.creativeUrl as string]));

  let withCreative = 0;
  let reused = 0;
  let creativeErrors = 0;

  const ads = await mapPool(rawAds, CREATIVE_CONCURRENCY, async (raw) => {
    const already = existingCreative.get(raw.adId);
    if (already) {
      reused += 1;
      return toIngestAd(raw, reusedCreative(already));
    }
    const persisted = await persistBestCreative(raw);
    if (persisted) withCreative += 1;
    else if (raw.imageUrls.length || raw.videoUrls.length) creativeErrors += 1;
    return toIngestAd(raw, persisted);
  });

  const ingest = await ingestAds(ads);
  return { fetched: rawAds.length, withCreative, reused, creativeErrors, ingest };
}

/** Sintetiza un PersistedCreative para un creativo ya hospedado (sin re-descargar). */
function reusedCreative(url: string): PersistedCreative {
  const kind: CreativeKind = /\.(mp4|webm|mov)(\?|$)/i.test(url) ? 'video' : 'image';
  return { url, key: '', bytes: 0, kind, originalUrl: '' };
}

/**
 * Intenta persistir el mejor creativo: primero VIDEOS (su URL caduca en ~1h),
 * luego imágenes. Devuelve el primero que se descargue y suba bien, o null.
 */
async function persistBestCreative(raw: RawAd): Promise<PersistedCreative | null> {
  const candidates: { url: string; kind: CreativeKind }[] = [
    ...raw.videoUrls.map((url) => ({ url, kind: 'video' as const })),
    ...raw.imageUrls.map((url) => ({ url, kind: 'image' as const })),
  ];
  for (const c of candidates) {
    try {
      return await persistCreative(raw.adId, c.url, c.kind);
    } catch (err) {
      console.warn(
        `[ad-ingest] creativo falló para ${raw.adId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return null;
}

/** Mapea un RawAd + creativo persistido al payload de ingesta (snake_case). */
function toIngestAd(raw: RawAd, persisted: PersistedCreative | null): IngestAd {
  return {
    store_name: raw.pageName,
    country: raw.country,
    ad_id: raw.adId,
    ad_library_url: raw.adLibraryUrl,
    copy_text: raw.copyText ?? '',
    // days_active REAL calculado de las fechas del anuncio.
    days_active: daysBetween(raw.startDate, raw.endDate),
    // Meta NO expone gasto real para anuncios comerciales en CO → 0. El Winner
    // Score usa impresiones/longevidad cuando no hay gasto (no confundir con $).
    estimated_spend: 0,
    estimated_impressions: impressionsMid(raw.impressionsRange),
    creative_url: persisted?.url ?? '',
    detected_at: undefined,
    cta_text: raw.ctaText,
    link_url: raw.linkUrl,
    publisher_platforms: raw.publisherPlatforms,
    is_active: raw.isActive,
    creative_type: persisted?.kind,
    original_creative_url: persisted?.originalUrl,
  };
}

function daysBetween(start?: Date, end?: Date): number {
  if (!start) return 0;
  const endMs = (end ?? new Date()).getTime();
  return Math.max(0, Math.floor((endMs - start.getTime()) / 86_400_000));
}

/** Punto medio del rango de impresiones (no es gasto), o undefined si no hay. */
function impressionsMid(range?: [number, number]): number | undefined {
  if (!range) return undefined;
  return Math.round((range[0] + range[1]) / 2);
}

/** Ejecuta `fn` sobre `items` con concurrencia acotada, preservando el orden. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
