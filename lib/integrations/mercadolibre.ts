import 'server-only';
import { getEnv } from '@/lib/config/env';

/**
 * Cliente de MercadoLibre para la saturación CO (nº de publicaciones de un
 * producto en MercadoLibre Colombia). Gateado por env: sin credenciales OAuth,
 * `fetchListingTotalCO` devuelve null y la competencia degrada a solo Ad Library.
 *
 * La búsqueda de ML exige OAuth (403 sin token). Se obtiene un access token a
 * partir del refresh token (no se persiste; vive en memoria por la duración del
 * proceso). Cualquier fallo → null (no lanza), para no romper el recompute.
 */
const ML_BASE = 'https://api.mercadolibre.com';

let cachedToken: { value: string; expiresAt: number } | null = null;

export function isMeliConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.MERCADOLIBRE_CLIENT_ID && env.MERCADOLIBRE_CLIENT_SECRET && env.MERCADOLIBRE_REFRESH_TOKEN);
}

/** Obtiene un access token vía refresh token (con caché en memoria). null si falla. */
async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const env = getEnv();
  try {
    const res = await fetch(`${ML_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.MERCADOLIBRE_CLIENT_ID,
        client_secret: env.MERCADOLIBRE_CLIENT_SECRET,
        refresh_token: env.MERCADOLIBRE_REFRESH_TOKEN,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 21_600) * 1000 };
    return cachedToken.value;
  } catch {
    return null;
  }
}

/** Nº total de publicaciones del producto en MercadoLibre Colombia (MCO), o null. */
export async function fetchMeliListingTotalCO(query: string): Promise<number | null> {
  if (!isMeliConfigured() || !query.trim()) return null;
  const url = `${ML_BASE}/sites/MCO/search?q=${encodeURIComponent(query.trim())}&limit=0`;
  // Hasta 2 intentos: si el token fue revocado antes de expirar, el 401 invalida
  // la caché y reintenta con uno fresco (sin esperar a expiresAt).
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getAccessToken();
    if (!token) return null;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      if (res.status === 401 && attempt === 0) {
        cachedToken = null;
        continue;
      }
      if (!res.ok) return null;
      const data = (await res.json()) as { paging?: { total?: number } };
      const total = data.paging?.total;
      return typeof total === 'number' ? total : null;
    } catch {
      return null;
    }
  }
  return null;
}
