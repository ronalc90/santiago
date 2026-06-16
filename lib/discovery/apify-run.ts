import 'server-only';
import { getEnv } from '@/lib/config/env';

const APIFY_BASE = 'https://api.apify.com/v2';
const TIMEOUT_MS = 90_000; // los scrapes tardan; el job corre en el worker

/**
 * Ejecuta un actor de Apify (sync) y devuelve los items del dataset. NUNCA lanza:
 * devuelve [] si falla (las fuentes de descubrimiento degradan sin romper el cron).
 * El token va en el header Authorization (no en la query) para no filtrarlo en logs.
 */
export async function runApifyActor(actorId: string, input: Record<string, unknown>): Promise<unknown[]> {
  const token = getEnv().APIFY_TOKEN;
  if (!token || !actorId) return [];
  const endpoint = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?clean=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[discovery:apify] actor ${actorId} respondió ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn(`[discovery:apify] actor ${actorId} falló:`, e instanceof Error ? e.message : e);
    return [];
  } finally {
    clearTimeout(timer);
  }
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
