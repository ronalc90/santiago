import 'server-only';
import { isMeliConfigured, searchCatalog } from '@/lib/integrations/mercadolibre';
import { getValidAccessToken } from '@/lib/services/meli';
import { DiscoverySource, DiscoveryCandidate } from './types';

/** site de ML → país ISO-2 (para etiquetar el candidato). */
const SITE_TO_COUNTRY: Record<string, string> = {
  MCO: 'CO', MLM: 'MX', MLA: 'AR', MLC: 'CL', MLB: 'BR', MPE: 'PE', MLU: 'UY',
};
/** país ISO-2 → site de ML (acepta ya un site id). */
const COUNTRY_TO_SITE: Record<string, string> = {
  CO: 'MCO', MX: 'MLM', AR: 'MLA', CL: 'MLC', BR: 'MLB', PE: 'MPE', UY: 'MLU',
};
function toSite(c: string): string {
  const u = c.trim().toUpperCase();
  if (/^M[A-Z]{2}$/.test(u)) return u; // ya es un site id (MCO, MLM…)
  return COUNTRY_TO_SITE[u] ?? 'MCO';
}

/**
 * Fuente GRATIS: catálogo de MercadoLibre por sitio + keyword. Reutiliza el
 * token OAuth (lib/services/meli) y /products/search. Si no hay conexión válida,
 * devuelve [] (no rompe el orquestador).
 */
export const mercadoLibreSource: DiscoverySource = {
  id: 'mercadolibre',
  esGratis: true,
  estaActiva: () => isMeliConfigured(),
  async buscar(params): Promise<DiscoveryCandidate[]> {
    const token = await getValidAccessToken();
    if (!token) {
      console.warn('[discovery:mercadolibre] configurado pero sin token válido (no conectado o AUTH_SECRET rotado); 0 candidatos de ML.');
      return [];
    }
    const out: DiscoveryCandidate[] = [];
    for (const country of params.countries) {
      const site = toSite(country);
      const iso = SITE_TO_COUNTRY[site] ?? country.toUpperCase();
      for (const keyword of params.keywords) {
        const r = await searchCatalog(site, keyword, token, Math.min(10, params.limit)).catch(() => null);
        if (!r) continue;
        for (const item of r.items) {
          out.push({
            name: item.name,
            category: item.domainId ?? keyword,
            country: iso,
            source: 'mercadolibre',
            metrics: { listingsCount: r.total },
          });
        }
      }
    }
    return out;
  },
};
