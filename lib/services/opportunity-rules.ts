import { DropiAvailability } from '@prisma/client';

/**
 * Reglas configurables del Motor de Oportunidad (score 0-100 por producto).
 * Mismo patrón que ScoringRules: defaults aquí, overrides en la tabla Setting
 * (key "opportunity_rules"). Los pesos van en escala libre (default 25 c/u) y se
 * normalizan a suma=1 al usar; las bandas son umbrales sobre el score.
 */

export type OpportunityBandName =
  | 'EXCELENTE'
  | 'MUY_BUENO'
  | 'BUENO'
  | 'RIESGOSO'
  | 'RECHAZAR'
  | 'SIN_DATOS';

export type DimensionKey = 'demand' | 'competition' | 'margin' | 'creatives';

export interface OpportunityRules {
  /** Pesos por dimensión (escala libre; se normaliza a suma=1 al usar). */
  weights: Record<DimensionKey, number>;
  /** Umbrales de banda sobre el score 0-100 (cascada). */
  bands: { excelente: number; muyBueno: number; bueno: number; riesgoso: number };
  /** Mínimo de dimensiones con dato para fijar banda; si no, SIN_DATOS. */
  minPresent: number;
  /** Confianza global mínima para considerar la banda "firme" (debajo: provisional). */
  minConfidence: number;
  demand: { advertisersHi: number; adsHi: number; ageLo: number; ageHi: number; breadthHi: number };
  competition: { mlLo: number; mlHi: number; coAdvertisersHi: number; blueOceanScore: number; mlWeight: number };
  margin: {
    marginLo: number;
    marginHi: number;
    roiLo: number;
    roiHi: number;
    /** Proxy sin Dropi: costo estimado = precio × ratio. */
    costRatioDefault: number;
    /** Último recurso: score por disponibilidad en Dropi. */
    availabilityScore: Record<DropiAvailability, number | null>;
    /**
     * Economía del pago contra entrega (COD). El margen bruto sobreestima la
     * rentabilidad en CO: el margen EFECTIVO descuenta devoluciones, flete de
     * vuelta y comisión de recaudo.
     */
    cod: {
      /** Fracción de pedidos devueltos (0-1). En CO suele ser 0.15–0.40. */
      returnRate: number;
      /** Comisión de recaudo COD sobre el precio cobrado (0-1). */
      gatewayPct: number;
      /** Flete de vuelta como múltiplo del flete de ida (1 = mismo costo). */
      returnShippingRatio: number;
    };
  };
  creatives: { videosHi: number; creativesHi: number; provenLo: number; provenHi: number; unusedBonus: number };
}

export const DEFAULT_OPPORTUNITY_RULES: OpportunityRules = {
  weights: { demand: 25, competition: 25, margin: 25, creatives: 25 },
  bands: { excelente: 90, muyBueno: 80, bueno: 70, riesgoso: 60 },
  minPresent: 2,
  minConfidence: 0.6,
  demand: { advertisersHi: 25, adsHi: 60, ageLo: 5, ageHi: 120, breadthHi: 4 },
  competition: { mlLo: 50, mlHi: 5000, coAdvertisersHi: 30, blueOceanScore: 90, mlWeight: 0.6 },
  margin: {
    marginLo: 0.3,
    marginHi: 0.75,
    roiLo: 0.5,
    roiHi: 4,
    costRatioDefault: 0.4,
    availabilityScore: { DISPONIBLE: 55, A_IMPORTAR: 40, NO_DISPONIBLE: 15, DESCONOCIDO: null },
    cod: { returnRate: 0.25, gatewayPct: 0.05, returnShippingRatio: 1 },
  },
  creatives: { videosHi: 8, creativesHi: 20, provenLo: 7, provenHi: 90, unusedBonus: 20 },
};

export const SETTING_KEYS_OPPORTUNITY = { OPPORTUNITY_RULES: 'opportunity_rules' } as const;

/** Etiqueta/tono de cada banda para la UI. */
export const BAND_META: Record<
  OpportunityBandName,
  { label: string; tone: 'green' | 'teal' | 'blue' | 'amber' | 'red' | 'gray' }
> = {
  EXCELENTE: { label: 'Excelente', tone: 'green' },
  MUY_BUENO: { label: 'Muy bueno', tone: 'teal' },
  BUENO: { label: 'Bueno', tone: 'blue' },
  RIESGOSO: { label: 'Riesgoso', tone: 'amber' },
  RECHAZAR: { label: 'Rechazar', tone: 'red' },
  SIN_DATOS: { label: 'Sin datos', tone: 'gray' },
};

/** Hash estable de la config para versionar los scores (detectar stale). */
export function rulesVersion(rules: OpportunityRules): string {
  const str = JSON.stringify(rules);
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
