import 'server-only';
import { getEnv } from '@/lib/config/env';
import { runApifyActor, pickStr } from './apify-run';
import { DiscoverySource, DiscoveryCandidate } from './types';

/** site ML → país ISO-2 (Meta usa ISO; los countries del cron pueden venir como site ML). */
const SITE_TO_ISO: Record<string, string> = { MCO: 'CO', MLM: 'MX', MLA: 'AR', MLC: 'CL', MLB: 'BR', MPE: 'PE', MLU: 'UY' };
function toIso(c: string): string {
  const u = c.trim().toUpperCase();
  return SITE_TO_ISO[u] ?? u.replace(/^M/, '').slice(0, 2);
}

/** Extrae creativos (imágenes/videos) de un item del actor de Meta Ad Library. */
function extractCreatives(item: Record<string, unknown>, country: string): DiscoveryCandidate['creatives'] {
  const out: NonNullable<DiscoveryCandidate['creatives']> = [];
  const snap = (item.snapshot ?? item) as Record<string, unknown>;
  const images = Array.isArray(snap.images) ? snap.images : [];
  for (const img of images) {
    const url = pickStr(img, 'original_image_url', 'resized_image_url', 'url');
    if (url) out.push({ url, type: 'image', country });
  }
  const videos = Array.isArray(snap.videos) ? snap.videos : [];
  for (const vid of videos) {
    const url = pickStr(vid, 'video_hd_url', 'video_sd_url', 'video_preview_image_url', 'url');
    if (url) out.push({ url, type: 'video', country });
  }
  const single = pickStr(item, 'creative_url', 'image_url');
  if (!out.length && single) out.push({ url: single, type: 'image', country });
  return out;
}

/**
 * Fuente de PAGO (off por defecto): Meta Ad Library multi-país vía Apify. Reutiliza
 * APIFY_ACTOR_ID (el mismo actor del Spy) + APIFY_TOKEN. Trae creativos para la galería.
 */
export const metaApifySource: DiscoverySource = {
  id: 'meta',
  esGratis: false,
  estaActiva: () => Boolean(getEnv().APIFY_TOKEN), // el on/off por config lo aplica el orquestador
  async buscar(params): Promise<DiscoveryCandidate[]> {
    const actorId = getEnv().APIFY_ACTOR_ID;
    const out: DiscoveryCandidate[] = [];
    for (const country of params.countries) {
      const iso = toIso(country);
      for (const keyword of params.keywords) {
        const items = await runApifyActor(actorId, { count: params.limit, country: iso, 'scrapePageAds.activeStatus': 'active', urls: [], searchTerms: [keyword] });
        for (const raw of items) {
          if (!raw || typeof raw !== 'object') continue;
          const item = raw as Record<string, unknown>;
          const name = pickStr(item, 'page_name') ?? pickStr(item.snapshot as Record<string, unknown>, 'title', 'caption') ?? keyword;
          out.push({
            name,
            category: keyword,
            country: iso,
            source: 'meta',
            metrics: {},
            creatives: extractCreatives(item, iso),
          });
        }
      }
    }
    return out;
  },
};
