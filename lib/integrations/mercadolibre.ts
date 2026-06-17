import 'server-only';
import { getEnv } from '@/lib/config/env';

/**
 * Cliente HTTP de MercadoLibre (sin estado ni BD): OAuth (authorize/exchange/refresh)
 * y búsqueda de saturación. La persistencia de tokens y el auto-refresh viven en la
 * capa de servicio (lib/services/meli.ts). El access token SIEMPRE viaja en el header
 * Authorization: Bearer, nunca en la query.
 */
const API_BASE = 'https://api.mercadolibre.com';
const TOKEN_URL = `${API_BASE}/oauth/token`;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

// Host de autorización por sitio (el endpoint de token es único y global).
const AUTH_HOSTS: Record<string, string> = {
  MCO: 'https://auth.mercadolibre.com.co',
  MLA: 'https://auth.mercadolibre.com.ar',
  MLM: 'https://auth.mercadolibre.com.mx',
  MLC: 'https://auth.mercadolibre.cl',
  MLU: 'https://auth.mercadolibre.com.uy',
  MPE: 'https://auth.mercadolibre.com.pe',
  MLB: 'https://auth.mercadolivre.com.br',
};

/** Nombre de la cookie con el `state` anti-CSRF del OAuth. */
export const OAUTH_STATE_COOKIE = 'meli_oauth_state';

export class MeliApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeliApiError';
  }
}

/** Token normalizado a camelCase desde la respuesta de ML (snake_case). */
export interface MeliTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos
  scope: string | null;
  userId: string | null;
}

/** True si hay credenciales de app para iniciar OAuth (gating de la feature). */
export function isMeliConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.MELI_CLIENT_ID && env.MELI_CLIENT_SECRET);
}

/**
 * URI de retorno del OAuth: prioriza MELI_REDIRECT_URI explícito; si está vacío,
 * la deriva de APP_URL. Debe coincidir EXACTO con la registrada en la app de ML.
 */
export function meliRedirectUri(): string {
  const env = getEnv();
  if (env.MELI_REDIRECT_URI) return env.MELI_REDIRECT_URI;
  if (/\blocalhost\b|127\.0\.0\.1/i.test(env.APP_URL)) {
    console.warn(
      '[meli] MELI_REDIRECT_URI vacío y APP_URL es localhost: el redirect_uri de OAuth apuntará a localhost ' +
        'y MercadoLibre rechazará el callback en producción. Define MELI_REDIRECT_URI o un APP_URL público https.',
    );
  }
  return `${env.APP_URL.replace(/\/$/, '')}/api/integrations/meli/callback`;
}

/** URL de autorización a la que se redirige al usuario para conceder el permiso. */
export function buildAuthorizeUrl(state: string): string {
  const env = getEnv();
  const host = AUTH_HOSTS[env.MELI_SITE_ID] ?? AUTH_HOSTS.MCO;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.MELI_CLIENT_ID,
    redirect_uri: meliRedirectUri(),
    // offline_access es OBLIGATORIO para que ML devuelva refresh_token (sin él solo
    // manda access_token y el intercambio fallaría al exigir el refresh). read = búsqueda.
    scope: 'offline_access read',
    state,
  });
  return `${host}/authorization?${params.toString()}`;
}

function parseToken(data: Record<string, unknown>): MeliTokenResponse {
  const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
  const refreshToken = typeof data.refresh_token === 'string' ? data.refresh_token : '';
  if (!accessToken || !refreshToken) {
    // Lista de CAMPOS recibidos (no valores) para diagnosticar: si no viene
    // refresh_token, falta habilitar el scope offline_access en la app de ML.
    const present = Object.keys(data).join(',') || 'ninguno';
    throw new MeliApiError(`MercadoLibre no devolvió refresh_token (recibido: ${present}); habilita offline_access en la app`);
  }
  return {
    accessToken,
    refreshToken,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 21_600,
    scope: typeof data.scope === 'string' ? data.scope : null,
    userId: data.user_id != null ? String(data.user_id) : null,
  };
}

async function postToken(body: Record<string, string>, maxRetries = MAX_RETRIES): Promise<MeliTokenResponse> {
  let lastError = '';
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let retryAfter: number | null = null;
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams(body),
        signal: controller.signal,
      });
      if (res.ok) return parseToken((await res.json()) as Record<string, unknown>);
      // 400 (invalid_grant/invalid_client) no se reintenta: el code/secret es inválido.
      if (!RETRYABLE_STATUS.has(res.status) || attempt === maxRetries) {
        const detail = await safeOAuthError(res);
        throw new MeliApiError(`MercadoLibre OAuth respondió ${res.status}${detail ? ` (${detail})` : ''}.`);
      }
      lastError = `HTTP ${res.status}`;
      retryAfter = retryAfterMs(res);
    } catch (err) {
      if (err instanceof MeliApiError) throw err;
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === maxRetries) throw new MeliApiError(`Error de red con MercadoLibre OAuth: ${lastError}`);
    } finally {
      clearTimeout(timer);
    }
    await sleep(retryAfter ?? backoffMs(attempt));
  }
  throw new MeliApiError(lastError || 'Error con MercadoLibre OAuth.');
}

/**
 * Intercambia el `code` del callback por tokens (grant_type=authorization_code).
 * El `code` es de UN SOLO USO: no se reintenta (un reintento lo quemaría y daría
 * invalid_grant). maxRetries=1.
 */
export async function exchangeCodeForToken(code: string): Promise<MeliTokenResponse> {
  const env = getEnv();
  return postToken(
    {
      grant_type: 'authorization_code',
      client_id: env.MELI_CLIENT_ID,
      client_secret: env.MELI_CLIENT_SECRET,
      code,
      redirect_uri: meliRedirectUri(),
    },
    1,
  );
}

/**
 * Renueva el access token con el refresh token. ML rota el refresh en CADA uso
 * (single-use), así que NO se reintenta a ciegas: un timeout/red podría haberlo
 * consumido del lado de ML y un reintento lo quemaría. maxRetries=1.
 */
export async function refreshAccessToken(refreshToken: string): Promise<MeliTokenResponse> {
  const env = getEnv();
  return postToken(
    {
      grant_type: 'refresh_token',
      client_id: env.MELI_CLIENT_ID,
      client_secret: env.MELI_CLIENT_SECRET,
      refresh_token: refreshToken,
    },
    1,
  );
}

/**
 * Nº de productos de catálogo activos que matchean `query` en el sitio
 * (paging.total), como proxy de saturación/competencia. O null si falla.
 * 0 es un valor VÁLIDO (sin competencia), distinto de null (no se pudo medir).
 *
 * Usa /products/search: el viejo /sites/{site}/search está PROHIBIDO (403) por ML
 * para apps de terceros (anti-scraping). /products/search sí responde con el conteo.
 */
export async function searchListingTotal(siteId: string, query: string, accessToken: string): Promise<number | null> {
  const q = query.trim();
  if (!q) return null;
  const url = `${API_BASE}/products/search?status=active&site_id=${encodeURIComponent(siteId)}&q=${encodeURIComponent(q)}&limit=1`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let retryAfter: number | null = null;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as { paging?: { total?: number } };
        const total = data.paging?.total;
        return typeof total === 'number' && Number.isFinite(total) ? total : null;
      }
      if (!RETRYABLE_STATUS.has(res.status) || attempt === MAX_RETRIES) return null;
      retryAfter = retryAfterMs(res);
    } catch {
      if (attempt === MAX_RETRIES) return null;
    } finally {
      clearTimeout(timer);
    }
    await sleep(retryAfter ?? backoffMs(attempt));
  }
  return null;
}

/** Catálogo de productos de un sitio para una búsqueda (descubrimiento). */
export interface MeliCatalogResult {
  total: number | null; // paging.total; null = no se pudo medir (≠ 0 = sin competencia)
  items: { name: string; domainId: string | null; pictures: string[] }[];
}

/**
 * Productos de catálogo (top N) que matchean `query` en el sitio + el total del
 * nicho (paging.total). Para descubrir candidatos. Null si falla (degrada).
 */
export async function searchCatalog(siteId: string, query: string, accessToken: string, limit = 10): Promise<MeliCatalogResult | null> {
  const q = query.trim();
  if (!q) return null;
  const n = Math.max(1, Math.min(50, limit));
  const url = `${API_BASE}/products/search?status=active&site_id=${encodeURIComponent(siteId)}&q=${encodeURIComponent(q)}&limit=${n}`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let retryAfter: number | null = null;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: controller.signal });
      if (res.ok) {
        const data = (await res.json()) as {
          paging?: { total?: number };
          results?: { name?: string; domain_id?: string; pictures?: { url?: string }[] }[];
        };
        // null = no medible (≠ 0 = sin competencia), igual que searchListingTotal.
        const total = typeof data.paging?.total === 'number' && Number.isFinite(data.paging.total) ? data.paging.total : null;
        const items = (data.results ?? [])
          .filter((r) => typeof r.name === 'string' && r.name.trim())
          .map((r) => ({
            name: r.name as string,
            domainId: r.domain_id ?? null,
            pictures: (r.pictures ?? []).map((p) => p?.url).filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 3),
          }));
        return { total, items };
      }
      if (!RETRYABLE_STATUS.has(res.status) || attempt === MAX_RETRIES) return null;
      retryAfter = retryAfterMs(res);
    } catch {
      if (attempt === MAX_RETRIES) return null;
    } finally {
      clearTimeout(timer);
    }
    await sleep(retryAfter ?? backoffMs(attempt));
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Backoff exponencial acotado: ~0.5s, 1s, 2s. */
function backoffMs(attempt: number): number {
  return 500 * 2 ** (attempt - 1);
}
/** Extrae el error de OAuth de ML ({error, message}) sin filtrar secretos. */
async function safeOAuthError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; message?: string; error_description?: string };
    return [j.error, j.error_description ?? j.message].filter(Boolean).join(': ').slice(0, 200);
  } catch {
    return '';
  }
}

/** Respeta el header Retry-After (segundos o fecha HTTP) en 429/5xx; acotado a 10s. */
function retryAfterMs(res: Response): number | null {
  const h = res.headers.get('retry-after');
  if (!h) return null;
  const secs = Number(h);
  if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 10_000);
  const at = Date.parse(h);
  if (!Number.isNaN(at)) return Math.min(Math.max(at - Date.now(), 0), 10_000);
  return null;
}
