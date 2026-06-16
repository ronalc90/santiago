import 'server-only';
import { getEnv } from '@/lib/config/env';
import { runApifyActor, pickStr } from './apify-run';
import { DiscoverySource, DiscoveryCandidate } from './types';

const SITE_TO_ISO: Record<string, string> = { MCO: 'CO', MLM: 'MX', MLA: 'AR', MLC: 'CL', MLB: 'BR', MPE: 'PE', MLU: 'UY' };
const toIso = (c: string): string => {
  const u = c.trim().toUpperCase();
  return SITE_TO_ISO[u] ?? u.replace(/^M/, '').slice(0, 2);
};

/**
 * Fuente de PAGO (off por defecto): TikTok vía un actor de Apify CONFIGURABLE
 * (TIKTOK_DISCOVERY_ACTOR). El shape del dataset varía por actor, así que el mapeo
 * es defensivo. Trae el video/cover como creativo para la galería.
 */
export const tiktokApifySource: DiscoverySource = {
  id: 'tiktok',
  esGratis: false,
  estaActiva: () => Boolean(getEnv().APIFY_TOKEN && getEnv().TIKTOK_DISCOVERY_ACTOR),
  async buscar(params): Promise<DiscoveryCandidate[]> {
    const actorId = getEnv().TIKTOK_DISCOVERY_ACTOR;
    const out: DiscoveryCandidate[] = [];
    for (const country of params.countries) {
      const iso = toIso(country);
      for (const keyword of params.keywords) {
        const items = await runApifyActor(actorId, {
          searchQueries: [keyword],
          keywords: [keyword],
          region: iso,
          resultsPerPage: params.limit,
          maxItems: params.limit,
        });
        for (const raw of items) {
          if (!raw || typeof raw !== 'object') continue;
          const item = raw as Record<string, unknown>;
          const name = (pickStr(item, 'title', 'desc', 'text', 'name') ?? keyword).slice(0, 140);
          const video = pickStr(item, 'videoUrl', 'webVideoUrl', 'downloadAddr', 'playAddr');
          const cover = pickStr(item, 'coverUrl', 'cover', 'originCover', 'dynamicCover');
          const creatives: NonNullable<DiscoveryCandidate['creatives']> = [];
          if (video) creatives.push({ url: video, type: 'video', country: iso });
          else if (cover) creatives.push({ url: cover, type: 'image', country: iso });
          out.push({ name, category: keyword, country: iso, source: 'tiktok', metrics: {}, creatives });
        }
      }
    }
    return out;
  },
};
