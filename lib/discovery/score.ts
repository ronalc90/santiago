import { DropiAvailability } from '@prisma/client';
import { OpportunitySignals } from '@/lib/services/opportunity';

/** Candidato ya agregado (post-dedupe) que alimenta el score. */
export interface AggregatedCandidate {
  countries: string[];
  interest: number | null; // 0-100 (tendencia)
  salesCount: number | null;
  listingsCount: number | null; // saturación de la fuente (no CO)
  daysActive: number | null;
  enCO: boolean;
  saturationCO: number | null; // publicaciones en MercadoLibre CO
  numImages: number;
  numVideos: number;
}

/**
 * Mapea un candidato de descubrimiento a las señales del motor 4×25 (NO duplica
 * el cálculo: reutiliza computeOpportunity). Es un proxy: la demanda sale del
 * interés/ventas/países/antigüedad; la competencia, de la saturación CO; el
 * margen queda sin dato (se completa al convertirlo en producto); los creativos,
 * de la galería recolectada.
 */
export function candidateToSignals(c: AggregatedCandidate): OpportunitySignals {
  const foreignCountries = c.countries.filter((x) => x.toUpperCase() !== 'CO').length;
  const demand = c.salesCount ?? c.interest ?? 0; // fuerza de demanda (proxy 0-100+)
  return {
    foreignAdvertisers: Math.round(demand / 4), // ~0-25
    foreignAds: Math.round(demand),
    foreignMaxDaysActive: c.daysActive ?? 0,
    foreignCountries,
    coAdvertisers: 0,
    coAds: 0,
    mlListingsCO: c.saturationCO,
    unitCost: null,
    shippingCost: null,
    salePrice: null,
    dropiAvailability: DropiAvailability.DESCONOCIDO,
    numVideos: c.numVideos,
    numImages: c.numImages,
    maxCreativeDaysActive: c.daysActive ?? 0,
    hasUnusedForeignCreative: foreignCountries > 0 && !c.enCO,
  };
}
