import 'server-only';
import { getEnv } from '@/lib/config/env';
import { APIFY_BASE } from '@/lib/config/constants';

const TIMEOUT_MS = 90_000; // los scrapes tardan; el job corre en el worker

/**
 * Ejecuta un actor de Apify (sync) y devuelve los items del dataset. NUNCA lanza:
 * devuelve [] si falla (las fuentes de descubrimiento degradan sin romper el cron).
 * El token va en el header Authorization (no en la query) para no filtrarlo en logs.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runApifyActor(actorId: string, input: Record<string, unknown>): Promise<unknown[]> {
  const token = getEnv().APIFY_TOKEN;
  if (!token || !actorId) return [];
  const endpoint = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?clean=true`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let retryMs: number | null = null;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
      if (!RETRYABLE.has(res.status) || attempt === MAX_RETRIES) {
        console.warn(`[discovery:apify] actor ${actorId} respondió ${res.status}`);
        return [];
      }
      const ra = Number(res.headers.get('retry-after'));
      retryMs = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 15_000) : 1000 * 2 ** (attempt - 1);
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        console.warn(`[discovery:apify] actor ${actorId} falló:`, e instanceof Error ? e.message : e);
        return [];
      }
      retryMs = 1000 * 2 ** (attempt - 1);
    } finally {
      clearTimeout(timer);
    }
    await sleep(retryMs ?? 1000);
  }
  return [];
}

/** Helpers de extracción defensiva del JSON (el shape del actor varía). */
export function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
export function pickStr(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    const s = str(v);
    if (s) return s;
  }
  return null;
}
