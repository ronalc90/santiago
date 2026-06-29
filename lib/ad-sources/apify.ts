import { AdSourceProvider, FetchAdsInput, RawAd } from '@/lib/ad-sources/types';
import { buildAdLibraryUrl } from '@/lib/ad-library';
import { getEnv } from '@/lib/config/env';
import { APIFY_BASE } from '@/lib/config/constants';

/**
 * Fuente de anuncios reales vía un actor de Apify que scrapea el Meta Ad Library
 * público (por defecto `curious_coder~facebook-ads-library-scraper`).
 *
 * Usa el endpoint REST síncrono `run-sync-get-dataset-items`, que ejecuta el
 * actor y devuelve los items del dataset en la misma respuesta. Mapeamos de
 * forma DEFENSIVA porque el esquema de salida varía entre actores/versiones.
 */
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
// El scraping puede tardar; damos margen amplio.
const REQUEST_TIMEOUT_MS = 240_000;
// El actor curious_coder exige "Maximum charged results" (count) >= 10.
const MIN_COUNT = 10;

type Json = unknown;
type JsonObject = Record<string, Json>;

function isObject(v: Json): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/** Lee una ruta anidada ('snapshot.images') tolerando ausencias. */
function pick(obj: Json, path: string): Json {
  let cur: Json = obj;
  for (const key of path.split('.')) {
    if (!isObject(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}
function asString(v: Json): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}
/** Primer valor string no vacío entre varias rutas candidatas. */
function firstString(obj: Json, paths: string[]): string {
  for (const p of paths) {
    const s = asString(pick(obj, p));
    if (s) return s;
  }
  return '';
}
function asArray(v: Json): Json[] {
  return Array.isArray(v) ? v : [];
}
/** Recolecta URLs de media de una lista de objetos probando varias claves. */
function collectUrls(list: Json, keys: string[]): string[] {
  const urls: string[] = [];
  for (const item of asArray(list)) {
    for (const k of keys) {
      const u = asString(isObject(item) ? item[k] : undefined);
      if (u && /^https?:\/\//.test(u)) {
        urls.push(u);
        break;
      }
    }
  }
  return urls;
}
/** Convierte un epoch (segundos o ms) o ISO a Date; undefined si no aplica. */
function toDate(v: Json): Date | undefined {
  if (typeof v === 'number' && v > 0) {
    const ms = v < 1e12 ? v * 1000 : v; // epoch en segundos vs ms
    return new Date(ms);
  }
  if (typeof v === 'string' && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

export class ApifyAdSource implements AdSourceProvider {
  private token: string;
  private actorId: string;

  constructor() {
    const env = getEnv();
    this.token = env.APIFY_TOKEN;
    this.actorId = env.APIFY_ACTOR_ID;
  }

  async fetchAds(input: FetchAdsInput): Promise<RawAd[]> {
    const url =
      input.pageUrl ?? buildAdLibraryUrl({ query: input.query, country: input.country });
    const body = {
      urls: [{ url }],
      // El actor cobra/limita por "count"; su mínimo es 10. Pedimos al menos eso
      // y recortamos al límite real después de mapear.
      count: Math.max(input.limit, MIN_COUNT),
      scrapeAdDetails: true,
    };

    const items = await this.runActor(body);
    const requested = input.country.toUpperCase();
    // Filtro de país (best-effort): si el item declara países y NO incluye el
    // solicitado, lo excluimos (p.ej. anuncios de Ecuador colados en una búsqueda
    // CO). Si la fuente no expone país, no filtramos (mejor incluir que perder).
    let excludedForeign = 0;
    const ads = items
      .map((it) => {
        const declared = extractCountries(it);
        if (declared.length > 0 && !declared.includes(requested)) {
          excludedForeign += 1;
          return null;
        }
        return this.mapItem(it, input.country, url);
      })
      .filter((ad): ad is RawAd => ad !== null);
    if (excludedForeign > 0) {
      console.log(`[apify] ${excludedForeign} anuncio(s) excluidos por país declarado != ${requested}`);
    }

    // Si no salió nada y el actor devolvió un item de error, propágalo claro.
    if (ads.length === 0) {
      const errItem = items.find((it) => isObject(it) && typeof it.error === 'string');
      if (errItem) throw new Error(`Apify ${this.actorId}: ${asString(pick(errItem, 'error'))}`);
    }

    return ads.slice(0, input.limit);
  }

  /** Ejecuta el actor (sync) con reintentos ante errores transitorios. */
  private async runActor(body: JsonObject): Promise<Json[]> {
    // El token va en el header Authorization (no en la query string) para que no
    // termine en logs de acceso/proxy (CWE-598).
    const endpoint = `${APIFY_BASE}/acts/${this.actorId}/run-sync-get-dataset-items?clean=true`;
    let lastError = '';
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as Json;
          return asArray(data);
        }
        const text = await res.text().catch(() => '');
        lastError = `Apify ${this.actorId} respondió ${res.status}: ${text.slice(0, 300)}`;
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new Error(lastError);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        lastError = isAbort ? `Apify ${this.actorId}: timeout tras ${REQUEST_TIMEOUT_MS / 1000}s` : message;
        if (attempt < MAX_RETRIES && (isAbort || message.includes('fetch') || message.includes('network'))) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new Error(lastError);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(lastError || `Apify ${this.actorId}: error desconocido`);
  }

  /** Mapea un item del dataset al RawAd; null si le falta el id (inservible). */
  private mapItem(it: Json, country: string, searchUrl: string): RawAd | null {
    const adId = firstString(it, ['ad_archive_id', 'adArchiveId', 'adArchiveID', 'ad_id', 'id']);
    if (!adId) return null;

    // Los carruseles (cards) pueden traer su propio video/imagen; en anuncios de
    // video el array raíz `videos` suele venir vacío y el creativo vive en cards.
    const cards = pick(it, 'snapshot.cards');
    // SD primero (más liviano y suficiente para previsualizar); HD como fallback.
    const sourceVideos = pick(it, 'snapshot.videos');
    const videos = dedup([
      ...collectUrls(sourceVideos, ['video_sd_url']),
      ...collectUrls(cards, ['video_sd_url']),
      ...collectUrls(sourceVideos, ['video_hd_url', 'url']),
      ...collectUrls(cards, ['video_hd_url']),
    ]);
    const images = dedup([
      ...collectUrls(pick(it, 'snapshot.images'), ['original_image_url', 'resized_image_url', 'url']),
      ...collectUrls(cards, ['original_image_url', 'resized_image_url']),
    ]);

    const pageName =
      firstString(it, ['snapshot.page_name', 'page_name', 'pageName']) || 'Anunciante desconocido';
    const copyText = firstString(it, ['snapshot.body.text', 'snapshot.body', 'body.text', 'body']);
    const ctaText = firstString(it, ['snapshot.cta_text', 'cta_text']);
    const linkUrl = firstString(it, ['snapshot.link_url', 'link_url']);
    const adLibraryUrl =
      firstString(it, ['ad_library_url', 'url']) ||
      buildAdLibraryUrl({ adArchiveId: adId, country }) ||
      searchUrl;

    const isActiveRaw = pick(it, 'is_active') ?? pick(it, 'isActive');
    const isActive = isActiveRaw === true || asString(isActiveRaw).toLowerCase() === 'true';

    const platforms = asArray(pick(it, 'publisher_platform') ?? pick(it, 'publisherPlatform'))
      .map(asString)
      .filter(Boolean);

    const impressionsRange = extractImpressions(it);

    return {
      adId,
      pageName,
      country: country.toUpperCase(),
      adLibraryUrl,
      copyText,
      ctaText: ctaText || undefined,
      linkUrl: linkUrl || undefined,
      startDate: toDate(pick(it, 'start_date') ?? pick(it, 'startDate')),
      endDate: toDate(pick(it, 'end_date') ?? pick(it, 'endDate')),
      isActive,
      publisherPlatforms: platforms,
      imageUrls: images,
      videoUrls: videos,
      impressionsRange,
    };
  }
}

function dedup(urls: string[]): string[] {
  return [...new Set(urls)];
}

/**
 * Códigos ISO-2 de país que el item declara (best-effort): prueba varias claves
 * candidatas que distintos actores exponen y recoge solo códigos de 2 letras.
 * Devuelve [] si no hay nada interpretable (entonces NO se filtra por país).
 */
function extractCountries(it: Json): string[] {
  const out = new Set<string>();
  const candidates = [
    pick(it, 'reached_countries'),
    pick(it, 'reachedCountries'),
    pick(it, 'countries'),
    pick(it, 'country'),
    pick(it, 'snapshot.country_iso_code'),
    pick(it, 'targeted_or_reached_countries'),
  ];
  const add = (v: Json) => {
    const s = asString(v).trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(s)) out.add(s);
  };
  for (const c of candidates) {
    if (Array.isArray(c)) c.forEach(add);
    else add(c);
  }
  return [...out];
}

/**
 * Convierte a número valores como 1000, "1,000", "10K", "1.5M".
 * Devuelve undefined si no es interpretable.
 */
function toNumber(v: Json): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return undefined;
  const m = v.trim().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([kKmM])?/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const mult = m[2] ? (/[kK]/.test(m[2]) ? 1_000 : 1_000_000) : 1;
  return Math.round(n * mult);
}

/** Parsea un texto de impresiones tipo "10K-15K" o "1,000 - 5,000" a [min,max]. */
function parseImpressionsText(text: string): [number, number] | undefined {
  if (!text) return undefined;
  const parts = text.split(/[-–—]/).map((p) => toNumber(p)).filter((n): n is number => n !== undefined);
  if (parts.length >= 2) return [parts[0], parts[1]];
  if (parts.length === 1) return [parts[0], parts[0]];
  return undefined;
}

/**
 * Extrae el rango de impresiones [min,max] del item. Meta solo expone cotas
 * numéricas para anuncios políticos/sociales (no comerciales en CO), así que
 * para la mayoría de anuncios comerciales esto será undefined.
 */
function extractImpressions(it: Json): [number, number] | undefined {
  // El objeto `impressions` puede venir a nivel raíz o dentro de `snapshot`.
  const lo = toNumber(pick(it, 'impressions.lower_bound') ?? pick(it, 'snapshot.impressions.lower_bound'));
  const hi = toNumber(pick(it, 'impressions.upper_bound') ?? pick(it, 'snapshot.impressions.upper_bound'));
  if (lo !== undefined && hi !== undefined) return [lo, hi];
  const text =
    asString(pick(it, 'impressionsWithIndex.impressions_text')) ||
    asString(pick(it, 'snapshot.impressionsWithIndex.impressions_text')) ||
    asString(pick(it, 'impressions.text')) ||
    asString(pick(it, 'snapshot.impressions.text'));
  return parseImpressionsText(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Backoff exponencial: ~1s, 2s, 4s. */
function backoffMs(attempt: number): number {
  return 1000 * 2 ** (attempt - 1);
}
