import 'server-only';
import { DiscoverySource, DiscoveryCandidate } from './types';

/**
 * Fuente GRATIS: interés de Google Trends por keyword × país (0-100, media de los
 * últimos 3 meses). Google NO tiene API oficial: se usa la API interna (explore →
 * widgetdata) que puede cambiar o bloquear IPs de servidor; por eso TODO degrada a
 * null/[] sin romper el cron. Activable por config (off por defecto).
 */
const SITE_TO_ISO: Record<string, string> = { MCO: 'CO', MLM: 'MX', MLA: 'AR', MLC: 'CL', MLB: 'BR', MPE: 'PE', MLU: 'UY' };
const toIso = (c: string): string => {
  const u = c.trim().toUpperCase();
  return SITE_TO_ISO[u] ?? u.replace(/^M/, '').slice(0, 2);
};

const BASE = 'https://trends.google.com/trends/api';
const TIMEOUT_MS = 10_000;

const asObj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** GET + parseo del JSON de Trends (viene con prefijo anti-JSON `)]}'`). null si falla. */
async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'es', 'User-Agent': 'Mozilla/5.0 (WinSpy)' }, signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    const start = text.indexOf('{');
    return start >= 0 ? JSON.parse(text.slice(start)) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function keywordInterest(keyword: string, geo: string): Promise<number | null> {
  const exploreReq = { comparisonItem: [{ keyword, geo, time: 'today 3-m' }], category: 0, property: '' };
  const explore = await getJson(`${BASE}/explore?hl=es&tz=0&req=${encodeURIComponent(JSON.stringify(exploreReq))}`);
  const widget = asArr(asObj(explore)?.widgets).map(asObj).find((x) => x?.id === 'TIMESERIES');
  if (!widget || typeof widget.token !== 'string' || widget.request == null) return null;
  const data = await getJson(`${BASE}/widgetdata/multiline?hl=es&tz=0&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${encodeURIComponent(widget.token)}`);
  const timeline = asArr(asObj(asObj(data)?.default)?.timelineData);
  const vals = timeline
    .map((p) => {
      const v = asArr(asObj(p)?.value)[0];
      return typeof v === 'number' ? v : null;
    })
    .filter((n): n is number => n != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export const googleTrendsSource: DiscoverySource = {
  id: 'trends',
  esGratis: true,
  estaActiva: () => true, // sin credencial; el on/off lo aplica la config
  async buscar(params): Promise<DiscoveryCandidate[]> {
    const out: DiscoveryCandidate[] = [];
    const geos = Array.from(new Set(params.countries.map(toIso)));
    for (const geo of geos) {
      for (const keyword of params.keywords) {
        const interest = await keywordInterest(keyword, geo).catch(() => null);
        if (interest != null) {
          out.push({ name: keyword, category: 'tendencia', country: geo, source: 'trends', metrics: { interest } });
        }
        await new Promise((r) => setTimeout(r, 400)); // rate-limit suave
      }
    }
    return out;
  },
};
