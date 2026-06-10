import { prisma } from '@/lib/db';
import { getScoringRules } from '@/lib/services/settings';
import { isForeignDemandSignal } from '@/lib/services/scoring';
import { fetchMeliListingTotalCO } from '@/lib/integrations/mercadolibre';
import { dropiLookupByName } from '@/lib/integrations/dropi';
import { OpportunitySignals } from '@/lib/services/opportunity';

/**
 * Arma las señales de oportunidad de un producto. Las de demanda/competencia/
 * creativos salen de los Ad YA ingeridos (cero red/Apify); ML y Dropi se
 * consultan puntualmente y degradan a null si fallan o no están configurados.
 */
export async function buildOpportunitySignals(productId: string): Promise<OpportunitySignals | null> {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { ads: true } });
  if (!product) return null;

  const rules = await getScoringRules();
  const ads = product.ads;
  const foreign = ads.filter((a) => a.country.toUpperCase() !== 'CO');
  const co = ads.filter((a) => a.country.toUpperCase() === 'CO');

  const distinct = (xs: string[]) => new Set(xs.map((x) => x.trim().toLowerCase())).size;
  const maxDays = (xs: { daysActive: number }[]) => xs.reduce((m, a) => Math.max(m, a.daysActive), 0);

  const foreignCountries = new Set(
    foreign.filter((a) => isForeignDemandSignal(a.country, a.daysActive, rules)).map((a) => a.country.toUpperCase()),
  ).size;

  const creativeType = (a: { raw: unknown }) =>
    (a.raw && typeof a.raw === 'object' ? (a.raw as { creative_type?: string }).creative_type : undefined);
  const withCreative = ads.filter((a) => a.creativeUrl);
  const numVideos = withCreative.filter((a) => creativeType(a) === 'video').length;
  const numImages = withCreative.filter((a) => creativeType(a) !== 'video').length;

  // ML y Dropi: puntuales y tolerantes a fallo (null).
  const [mlListingsCO, dropi] = await Promise.all([
    fetchMeliListingTotalCO(product.name).catch(() => null),
    dropiLookupByName(product.name).catch(() => null),
  ]);

  return {
    foreignAdvertisers: distinct(foreign.map((a) => a.storeName)),
    foreignAds: foreign.length,
    foreignMaxDaysActive: maxDays(foreign),
    foreignCountries,
    coAdvertisers: distinct(co.map((a) => a.storeName)),
    coAds: co.length,
    mlListingsCO,
    dropiCost: dropi?.cost ?? null,
    salePrice: product.salePrice ?? null,
    dropiAvailability: product.dropiAvailability,
    numVideos,
    numImages,
    maxCreativeDaysActive: maxDays(withCreative),
    hasUnusedForeignCreative:
      product.hasUnusedForeignCreative || ads.some((a) => a.hasUnusedForeignCreative),
  };
}

/** Variante sin red (para recompute masivo): ML/Dropi quedan null. */
export function buildOpportunitySignalsFromAds(
  product: {
    name: string;
    salePrice: number | null;
    dropiAvailability: OpportunitySignals['dropiAvailability'];
    hasUnusedForeignCreative: boolean;
  },
  ads: { storeName: string; country: string; daysActive: number; creativeUrl: string | null; hasUnusedForeignCreative: boolean; raw: unknown }[],
  minDiasOtroPais: number,
): OpportunitySignals {
  const foreign = ads.filter((a) => a.country.toUpperCase() !== 'CO');
  const co = ads.filter((a) => a.country.toUpperCase() === 'CO');
  const distinct = (xs: string[]) => new Set(xs.map((x) => x.trim().toLowerCase())).size;
  const maxDays = (xs: { daysActive: number }[]) => xs.reduce((m, a) => Math.max(m, a.daysActive), 0);
  const creativeType = (a: { raw: unknown }) =>
    (a.raw && typeof a.raw === 'object' ? (a.raw as { creative_type?: string }).creative_type : undefined);
  const withCreative = ads.filter((a) => a.creativeUrl);

  return {
    foreignAdvertisers: distinct(foreign.map((a) => a.storeName)),
    foreignAds: foreign.length,
    foreignMaxDaysActive: maxDays(foreign),
    foreignCountries: new Set(
      foreign.filter((a) => a.country.toUpperCase() !== 'CO' && a.daysActive >= minDiasOtroPais).map((a) => a.country.toUpperCase()),
    ).size,
    coAdvertisers: distinct(co.map((a) => a.storeName)),
    coAds: co.length,
    mlListingsCO: null,
    dropiCost: null,
    salePrice: product.salePrice,
    dropiAvailability: product.dropiAvailability,
    numVideos: withCreative.filter((a) => creativeType(a) === 'video').length,
    numImages: withCreative.filter((a) => creativeType(a) !== 'video').length,
    maxCreativeDaysActive: maxDays(withCreative),
    hasUnusedForeignCreative: product.hasUnusedForeignCreative || ads.some((a) => a.hasUnusedForeignCreative),
  };
}
