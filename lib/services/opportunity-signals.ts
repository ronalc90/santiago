import { prisma } from '@/lib/db';
import { getScoringRules } from '@/lib/services/settings';
import { isForeignDemandSignal } from '@/lib/services/scoring';
import { OpportunitySignals } from '@/lib/services/opportunity';

/** Costo por artículo efectivo: el sincronizado de Shopify manda; si no, el manual. */
function effectiveUnitCost(p: { shopifyUnitCost: number | null; manualCost: number | null }): number | null {
  return p.shopifyUnitCost ?? p.manualCost ?? null;
}

const creativeType = (a: { raw: unknown }) =>
  a.raw && typeof a.raw === 'object' ? (a.raw as { creative_type?: string }).creative_type : undefined;
const distinct = (xs: string[]) => new Set(xs.map((x) => x.trim().toLowerCase())).size;
const maxDays = (xs: { daysActive: number }[]) => xs.reduce((m, a) => Math.max(m, a.daysActive), 0);

/**
 * Arma las señales de oportunidad de un producto. Todo sale de datos ya
 * persistidos (cero red): demanda/competencia/creativos de los Ad ingeridos, la
 * saturación de ML del `saturationCount` (lo mide el worker) y el COSTO de
 * Shopify/manual (Dropi no expone API a terceros; su costo llega a Shopify).
 */
export async function buildOpportunitySignals(productId: string): Promise<OpportunitySignals | null> {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { ads: true } });
  if (!product) return null;

  const rules = await getScoringRules();
  const ads = product.ads;
  const foreign = ads.filter((a) => a.country.toUpperCase() !== 'CO');
  const co = ads.filter((a) => a.country.toUpperCase() === 'CO');
  const withCreative = ads.filter((a) => a.creativeUrl);

  const foreignCountries = new Set(
    foreign.filter((a) => isForeignDemandSignal(a.country, a.daysActive, rules)).map((a) => a.country.toUpperCase()),
  ).size;

  return {
    foreignAdvertisers: distinct(foreign.map((a) => a.storeName)),
    foreignAds: foreign.length,
    foreignMaxDaysActive: maxDays(foreign),
    foreignCountries,
    coAdvertisers: distinct(co.map((a) => a.storeName)),
    coAds: co.length,
    mlListingsCO: product.saturationCount ?? null,
    unitCost: effectiveUnitCost(product),
    shippingCost: product.shippingCost ?? null,
    salePrice: product.salePrice ?? null,
    dropiAvailability: product.dropiAvailability,
    codReturnRateOverride: product.realReturnRate ?? null,
    numVideos: withCreative.filter((a) => creativeType(a) === 'video').length,
    numImages: withCreative.filter((a) => creativeType(a) !== 'video').length,
    maxCreativeDaysActive: maxDays(withCreative),
    hasUnusedForeignCreative: product.hasUnusedForeignCreative || ads.some((a) => a.hasUnusedForeignCreative),
  };
}

/** Variante sin red (recompute masivo): usa la saturación ya medida (saturationCount). */
export function buildOpportunitySignalsFromAds(
  product: {
    salePrice: number | null;
    shopifyUnitCost: number | null;
    manualCost: number | null;
    shippingCost: number | null;
    saturationCount: number | null;
    dropiAvailability: OpportunitySignals['dropiAvailability'];
    hasUnusedForeignCreative: boolean;
    realReturnRate: number | null;
  },
  ads: { storeName: string; country: string; daysActive: number; creativeUrl: string | null; hasUnusedForeignCreative: boolean; raw: unknown }[],
  minDiasOtroPais: number,
): OpportunitySignals {
  const foreign = ads.filter((a) => a.country.toUpperCase() !== 'CO');
  const co = ads.filter((a) => a.country.toUpperCase() === 'CO');
  const withCreative = ads.filter((a) => a.creativeUrl);

  return {
    foreignAdvertisers: distinct(foreign.map((a) => a.storeName)),
    foreignAds: foreign.length,
    foreignMaxDaysActive: maxDays(foreign),
    foreignCountries: new Set(
      foreign.filter((a) => a.daysActive >= minDiasOtroPais).map((a) => a.country.toUpperCase()),
    ).size,
    coAdvertisers: distinct(co.map((a) => a.storeName)),
    coAds: co.length,
    mlListingsCO: product.saturationCount ?? null,
    unitCost: effectiveUnitCost(product),
    shippingCost: product.shippingCost ?? null,
    salePrice: product.salePrice,
    dropiAvailability: product.dropiAvailability,
    codReturnRateOverride: product.realReturnRate ?? null,
    numVideos: withCreative.filter((a) => creativeType(a) === 'video').length,
    numImages: withCreative.filter((a) => creativeType(a) !== 'video').length,
    maxCreativeDaysActive: maxDays(withCreative),
    hasUnusedForeignCreative: product.hasUnusedForeignCreative || ads.some((a) => a.hasUnusedForeignCreative),
  };
}
