import { AdSourceProvider, FetchAdsInput, RawAd } from '@/lib/ad-sources/types';
import { buildAdLibraryUrl } from '@/lib/ad-library';

/**
 * Fuente de anuncios de DEMO. No gasta créditos y devuelve URLs de imagen
 * descargables (placehold.co) para poder ejercitar el pipeline COMPLETO en
 * desarrollo/tests: fetch → descarga del creativo → re-hospedaje en storage →
 * ingestAds. No es data real; para data real usa AD_SOURCE_PROVIDER="apify".
 */
export class MockAdSource implements AdSourceProvider {
  async fetchAds(input: FetchAdsInput): Promise<RawAd[]> {
    const country = input.country.toUpperCase();
    const term = (input.query || input.pageUrl || 'demo').trim();
    const count = Math.min(input.limit, 3);

    return Array.from({ length: count }, (_, i) => {
      const adId = `MOCK-${country}-${slugify(term)}-${i + 1}`;
      const start = new Date(2026, 0, 1 + i);
      const label = `${term} #${i + 1}`;
      return {
        adId,
        pageName: `Demo Store ${country}`,
        country,
        adLibraryUrl: buildAdLibraryUrl({ query: term, country }),
        copyText: `Anuncio de demo para "${term}" — creativo de prueba ${i + 1}.`,
        ctaText: 'Comprar ahora',
        linkUrl: 'https://example.com',
        startDate: start,
        endDate: undefined,
        isActive: true,
        publisherPlatforms: ['facebook', 'instagram'],
        imageUrls: [`https://placehold.co/600x600/0f172a/f8fafc/png?text=${encodeURIComponent(label)}`],
        videoUrls: [],
        impressionsRange: [1000 * (i + 1), 5000 * (i + 1)],
      } satisfies RawAd;
    });
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}
