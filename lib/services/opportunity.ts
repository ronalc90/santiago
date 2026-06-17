import { DropiAvailability } from '@prisma/client';
import {
  OpportunityRules,
  DEFAULT_OPPORTUNITY_RULES,
  OpportunityBandName,
  DimensionKey,
} from '@/lib/services/opportunity-rules';

/**
 * Motor de Oportunidad — lógica PURA (sin Prisma ni red). Cada dimensión es una
 * función score(señales, reglas) → DimensionResult; `computeOpportunity` las
 * combina con pesos re-normalizados sobre las dimensiones con dato. Espeja a
 * `computeWinnerScoreFromSignals`: toda la I/O vive fuera de este módulo.
 */

// --- Helpers de normalización (puros) --------------------------------------
export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
export function scale(x: number, lo: number, hi: number): number {
  if (hi <= lo) return 0;
  return clamp01((x - lo) / (hi - lo));
}
export function to100(u: number): number {
  return Math.round(clamp01(u) * 100);
}
/** Acota un valor ya en escala 0-100 (para config inyectada directa al score). */
export function clamp100(x: number): number {
  return Math.max(0, Math.min(100, Math.round(x)));
}
/** Escala logarítmica para conteos con cola larga (anuncios, publicaciones). */
export function logScale(x: number, lo: number, hi: number): number {
  return scale(Math.log10(1 + Math.max(0, x)), Math.log10(1 + lo), Math.log10(1 + hi));
}

// --- Tipos ------------------------------------------------------------------
export interface OpportunitySignals {
  // Demanda internacional (anuncios fuera de CO)
  foreignAdvertisers: number;
  foreignAds: number;
  foreignMaxDaysActive: number;
  foreignCountries: number;
  // Competencia CO
  coAdvertisers: number;
  coAds: number;
  mlListingsCO: number | null;
  // Margen
  unitCost: number | null; // costo por artículo (Shopify o manual)
  shippingCost: number | null; // costo de envío por unidad (opcional)
  salePrice: number | null;
  dropiAvailability: DropiAvailability;
  // Creativos
  numVideos: number;
  numImages: number;
  maxCreativeDaysActive: number;
  hasUnusedForeignCreative: boolean;
}

export interface DimensionResult {
  score: number | null; // 0-100 redondeado, o null si no calculable
  confidence: number; // 0-1
  estimated: boolean;
  signals: Record<string, unknown>;
  reasons: string[];
}

export interface OpportunityResult {
  score: number | null;
  band: OpportunityBandName;
  confidence: number;
  estimated: boolean;
  dimensions: Record<DimensionKey, DimensionResult>;
  weightsUsed: Record<DimensionKey, number>;
  weightsEffective: Record<DimensionKey, number>;
  coverage: number;
}

// --- D1: Demanda internacional ---------------------------------------------
export function demandScore(s: OpportunitySignals, r: OpportunityRules = DEFAULT_OPPORTUNITY_RULES): DimensionResult {
  const signals = {
    foreignAdvertisers: s.foreignAdvertisers,
    foreignAds: s.foreignAds,
    foreignMaxDaysActive: s.foreignMaxDaysActive,
    foreignCountries: s.foreignCountries,
  };
  if (s.foreignAdvertisers === 0 && s.foreignAds === 0) {
    return { score: null, confidence: 0, estimated: true, signals, reasons: ['Sin anuncios internacionales: demanda no comprobada'] };
  }
  const sAdvertisers = to100(logScale(s.foreignAdvertisers, 1, r.demand.advertisersHi));
  const sVolume = to100(logScale(s.foreignAds, 1, r.demand.adsHi));
  const sAge = to100(scale(s.foreignMaxDaysActive, r.demand.ageLo, r.demand.ageHi));
  const sBreadth = to100(scale(s.foreignCountries, 1, r.demand.breadthHi));
  const score = Math.round(0.35 * sAdvertisers + 0.25 * sVolume + 0.25 * sAge + 0.15 * sBreadth);
  const firm = s.foreignAdvertisers >= 3 && s.foreignMaxDaysActive >= r.demand.ageLo;
  return {
    score,
    confidence: firm ? 1 : 0.5,
    estimated: !firm,
    signals,
    reasons: [
      `${s.foreignAdvertisers} anunciante(s) distinto(s) fuera de CO, ${s.foreignCountries} país(es), máx ${s.foreignMaxDaysActive} días activos`,
    ],
  };
}

// --- D2: Competencia Colombia (inverso de saturación) ----------------------
export function competitionScore(s: OpportunitySignals, r: OpportunityRules = DEFAULT_OPPORTUNITY_RULES): DimensionResult {
  const signals = { mlListingsCO: s.mlListingsCO, coAdvertisers: s.coAdvertisers, coAds: s.coAds };
  // Océano azul: sin competencia detectada (tope blueOcean, no 100, por si faltan datos).
  if (s.coAdvertisers === 0 && (s.mlListingsCO === null || s.mlListingsCO < r.competition.mlLo)) {
    const hasMl = s.mlListingsCO !== null;
    return {
      score: clamp100(r.competition.blueOceanScore),
      confidence: hasMl ? 1 : 0.5,
      estimated: !hasMl,
      signals,
      reasons: ['Sin competencia detectada en CO (océano azul)'],
    };
  }
  const pAds = to100(logScale(s.coAdvertisers, 1, r.competition.coAdvertisersHi));
  let saturation: number;
  let estimated: boolean;
  let confidence: number;
  const reasons: string[] = [];
  if (s.mlListingsCO !== null) {
    const pMl = to100(logScale(s.mlListingsCO, r.competition.mlLo, r.competition.mlHi));
    saturation = r.competition.mlWeight * pMl + (1 - r.competition.mlWeight) * pAds;
    estimated = false;
    confidence = 1;
    reasons.push(`${s.mlListingsCO} publicaciones en MercadoLibre CO y ${s.coAdvertisers} anunciante(s) en Ad Library`);
  } else {
    saturation = pAds;
    estimated = true;
    confidence = 0.5;
    reasons.push('Saturación de MercadoLibre sin medir: competencia estimada solo con Ad Library CO');
  }
  return { score: 100 - Math.round(saturation), confidence, estimated, signals, reasons };
}

// --- D3: Margen — cascada de degradación -----------------------------------
// El costo (unitCost) viene de Shopify (sincronizado desde Dropi vía la
// integración oficial) o de un costo manual. Dropi NO expone API a terceros.

/**
 * Margen EFECTIVO en pago contra entrega (COD). El margen bruto sobreestima la
 * rentabilidad en Colombia: una fracción `returnRate` de los pedidos se
 * devuelve y, en esos, se pierden el flete de ida y el de vuelta (el producto
 * regresa al proveedor, así que NO se pierde su costo) y nunca se cobra. En los
 * entregados se paga además la comisión de recaudo (`gatewayPct`).
 *
 * Devuelve el margen y ROI EFECTIVOS (esperados por pedido intentado) y el
 * profit potential por pedido en la moneda del producto (= AOV × margen
 * efectivo, con AOV = precio de venta de una unidad). Un producto que pierde
 * tras devoluciones da margen negativo → score 0 (no lo lanzas).
 */
export function effectiveCodMargin(
  unitCost: number,
  shipping: number,
  price: number,
  cod: OpportunityRules['margin']['cod'],
): { margenPct: number; roi: number; profitPerOrder: number } {
  const returnRate = clamp01(cod.returnRate);
  const gateway = clamp01(cod.gatewayPct);
  const returnShipping = shipping * Math.max(0, cod.returnShippingRatio);
  const profitDelivered = price - unitCost - shipping - gateway * price;
  const lossReturned = shipping + returnShipping; // sin ingreso; el producto regresa
  const profitPerOrder = (1 - returnRate) * profitDelivered - returnRate * lossReturned;
  const margenPct = price > 0 ? profitPerOrder / price : 0;
  const costBase = unitCost + shipping; // caja en riesgo por pedido
  const roi = costBase > 0 ? profitPerOrder / costBase : 0;
  return { margenPct, roi, profitPerOrder };
}

export function marginScore(s: OpportunitySignals, r: OpportunityRules = DEFAULT_OPPORTUNITY_RULES): DimensionResult {
  const cod = r.margin.cod;
  const signals = { unitCost: s.unitCost, shippingCost: s.shippingCost, salePrice: s.salePrice, dropiAvailability: s.dropiAvailability, cod };
  const shipping = s.shippingCost ?? 0;
  const fmtCop = (n: number) => Math.round(n).toLocaleString('es-CO');

  const fromCost = (unitCost: number, price: number, estimated: boolean, confidence: number, reason: string): DimensionResult => {
    const eff = effectiveCodMargin(unitCost, shipping, price, cod);
    const sMargin = to100(scale(eff.margenPct, r.margin.marginLo, r.margin.marginHi));
    const sRoi = to100(logScale(eff.roi, r.margin.roiLo, r.margin.roiHi));
    const score = Math.round(0.6 * sMargin + 0.4 * sRoi);
    const reasons = [
      reason,
      `margen efectivo COD ${(eff.margenPct * 100).toFixed(0)}% · ROI ${eff.roi.toFixed(1)}x (devol. ${Math.round(cod.returnRate * 100)}%)`,
      `profit potential ≈ $${fmtCop(eff.profitPerOrder)}/pedido`,
    ];
    if (s.dropiAvailability === 'NO_DISPONIBLE') reasons.push('ojo: no disponible en Dropi (sin logística)');
    return { score, confidence, estimated, signals, reasons };
  };

  // Nivel 1: costo real (Shopify/manual) + precio → margen efectivo COD (con envío).
  if (s.unitCost !== null && s.salePrice !== null) {
    return fromCost(s.unitCost, s.salePrice, false, 1, 'costo real (Shopify/manual)');
  }
  // Nivel 2: precio sin costo → costo estimado por ratio.
  if (s.salePrice !== null && s.unitCost === null) {
    return fromCost(s.salePrice * r.margin.costRatioDefault, s.salePrice, true, 0.4, 'costo estimado (falta costo real)');
  }
  // Nivel 3: solo disponibilidad Dropi (último recurso).
  const availScore = r.margin.availabilityScore[s.dropiAvailability];
  if (s.salePrice === null && s.unitCost === null && availScore !== null && availScore !== undefined) {
    return { score: clamp100(availScore), confidence: 0.3, estimated: true, signals, reasons: ['margen estimado por disponibilidad en Dropi'] };
  }
  // Nivel 4: no calculable.
  return { score: null, confidence: 0, estimated: true, signals, reasons: ['margen no calculable: falta costo y precio'] };
}

// --- D4: Calidad de creativos ----------------------------------------------
export function creativesScore(s: OpportunitySignals, r: OpportunityRules = DEFAULT_OPPORTUNITY_RULES): DimensionResult {
  const numCreatives = s.numVideos + s.numImages;
  const signals = {
    numVideos: s.numVideos,
    numImages: s.numImages,
    maxCreativeDaysActive: s.maxCreativeDaysActive,
    hasUnusedForeignCreative: s.hasUnusedForeignCreative,
  };
  if (numCreatives === 0) {
    return { score: null, confidence: 0, estimated: true, signals, reasons: ['Sin creativos disponibles'] };
  }
  const sVideo = to100(logScale(s.numVideos, 1, r.creatives.videosHi));
  const sVolume = to100(logScale(numCreatives, 1, r.creatives.creativesHi));
  const sProven = to100(scale(s.maxCreativeDaysActive, r.creatives.provenLo, r.creatives.provenHi));
  const bUnused = s.hasUnusedForeignCreative ? 100 : 0;
  const score = Math.round(0.3 * sVideo + 0.25 * sVolume + 0.25 * sProven + (r.creatives.unusedBonus / 100) * bUnused);
  const firm = s.numVideos >= 1 || numCreatives >= 3;
  const reasons = [`${s.numVideos} video(s), ${numCreatives} creativo(s)`];
  if (s.hasUnusedForeignCreative) reasons.push('creativo extranjero sin usar en CO');
  return { score: Math.min(100, score), confidence: firm ? 1 : 0.6, estimated: !firm, signals, reasons };
}

// --- Clasificación y composición -------------------------------------------
export function classifyOpportunity(score: number | null, r: OpportunityRules = DEFAULT_OPPORTUNITY_RULES): OpportunityBandName {
  if (score === null) return 'SIN_DATOS';
  if (score >= r.bands.excelente) return 'EXCELENTE';
  if (score >= r.bands.muyBueno) return 'MUY_BUENO';
  if (score >= r.bands.bueno) return 'BUENO';
  if (score >= r.bands.riesgoso) return 'RIESGOSO';
  return 'RECHAZAR';
}

const DIMS: DimensionKey[] = ['demand', 'competition', 'margin', 'creatives'];

export function composeOpportunity(
  dims: Record<DimensionKey, DimensionResult>,
  r: OpportunityRules = DEFAULT_OPPORTUNITY_RULES,
): {
  score: number | null;
  weightsUsed: Record<DimensionKey, number>;
  weightsEffective: Record<DimensionKey, number>;
  confidence: number;
  coverage: number;
  presentCount: number;
} {
  const totalW = DIMS.reduce((sum, k) => sum + Math.max(0, r.weights[k]), 0) || 1;
  const weightsUsed = Object.fromEntries(DIMS.map((k) => [k, Math.max(0, r.weights[k]) / totalW])) as Record<DimensionKey, number>;

  const present = DIMS.filter((k) => dims[k].score !== null);
  const presentW = present.reduce((sum, k) => sum + weightsUsed[k], 0);
  const weightsEffective = Object.fromEntries(
    DIMS.map((k) => [k, present.includes(k) && presentW > 0 ? weightsUsed[k] / presentW : 0]),
  ) as Record<DimensionKey, number>;

  // present vacío o sin peso efectivo (todos los pesos presentes en 0) = ausencia → null
  // (evita un 0/RECHAZAR espurio cuando la config degenera los pesos).
  const score = present.length === 0 || presentW <= 0
    ? null
    : Math.round(present.reduce((sum, k) => sum + weightsEffective[k] * (dims[k].score as number), 0));

  // Confianza = fracción del peso respaldada por dimensiones presentes y NO estimadas.
  const realW = present.filter((k) => !dims[k].estimated).reduce((sum, k) => sum + weightsUsed[k], 0);
  const confidence = Math.round(realW * 100) / 100;

  return { score, weightsUsed, weightsEffective, confidence, coverage: present.length / DIMS.length, presentCount: present.length };
}

export function computeOpportunity(s: OpportunitySignals, r: OpportunityRules = DEFAULT_OPPORTUNITY_RULES): OpportunityResult {
  const dimensions: Record<DimensionKey, DimensionResult> = {
    demand: demandScore(s, r),
    competition: competitionScore(s, r),
    margin: marginScore(s, r),
    creatives: creativesScore(s, r),
  };
  const comp = composeOpportunity(dimensions, r);
  // Si no hay datos suficientes, score Y banda van juntos a "sin datos" (nunca un
  // número con banda SIN_DATOS, que se mostraría y ordenaría incoherente).
  const gated = comp.score === null || comp.presentCount < r.minPresent;
  const score = gated ? null : comp.score;
  const band: OpportunityBandName = gated ? 'SIN_DATOS' : classifyOpportunity(score, r);
  const estimated =
    comp.presentCount < DIMS.length ||
    DIMS.some((k) => dimensions[k].score !== null && dimensions[k].estimated) ||
    comp.confidence < r.minConfidence;
  return {
    score,
    band,
    confidence: comp.confidence,
    estimated,
    dimensions,
    weightsUsed: comp.weightsUsed,
    weightsEffective: comp.weightsEffective,
    coverage: comp.coverage,
  };
}
