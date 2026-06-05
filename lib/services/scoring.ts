import { AdClassification } from '@prisma/client';

/**
 * Reglas configurables del Winner Score y la clasificación.
 * Se persisten en la tabla `Setting` (key = "scoring_rules") y el usuario
 * las edita desde la UI. Aquí viven los valores por defecto y los tipos.
 */
export interface ScoringRules {
  /** Umbral de Winner Score para 🔴 LANZAR (>=). */
  lanzarScore: number;
  /** Umbral de Winner Score para 🟡 CONSIDERAR (>=). */
  considerarScore: number;
  /** Umbral de Winner Score para 🟢 MONITOREAR (>=). Por debajo => MONITOREAR igual. */
  monitorearScore: number;
  /** Días activos a partir de los cuales un anuncio se considera ⚪ SATURADO. */
  saturadoDias: number;
  /** Días activos mínimos en otro país para tomarse como señal de demanda real. */
  minDiasOtroPais: number;
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  lanzarScore: 1000, // gasto/día alto => producto fuerte
  considerarScore: 400,
  monitorearScore: 100,
  saturadoDias: 90, // demasiado tiempo corriendo => mercado posiblemente saturado
  minDiasOtroPais: 5, // +5 días activos en otro país = demanda validada
};

export const SETTING_KEYS = {
  SCORING_RULES: 'scoring_rules',
} as const;

/**
 * Winner Score = gasto estimado / días activos.
 * Mide la intensidad de inversión diaria: a mayor gasto por día, más fuerte
 * la señal de que el producto está funcionando para el competidor.
 * Si daysActive es 0, usamos 1 para no dividir por cero (anuncio recién detectado).
 */
export function computeWinnerScore(estimatedSpend: number, daysActive: number): number {
  const spend = Number.isFinite(estimatedSpend) && estimatedSpend > 0 ? estimatedSpend : 0;
  const days = Number.isFinite(daysActive) && daysActive > 0 ? daysActive : 1;
  return Math.round((spend / days) * 100) / 100;
}

/** Factor para escalar impresiones/día a una magnitud comparable a gasto/día. */
const IMPRESSIONS_PER_DAY_FACTOR = 0.05;
/** Factor de longevidad: días activos × K (sin techo) cuando no hay gasto. */
const LONGEVITY_FACTOR = 12;

export interface WinnerSignals {
  estimatedSpend: number;
  daysActive: number;
  /** Punto medio del rango de impresiones, si la fuente lo expone. */
  estimatedImpressions?: number | null;
}

/**
 * Winner Score robusto a la falta de gasto. Meta NO expone gasto para anuncios
 * comerciales en CO, así que `computeWinnerScore` (gasto/día) da 0 para todos.
 * Esta función degrada con elegancia a la mejor señal disponible:
 *   1) hay gasto real → gasto/día (idéntico a computeWinnerScore).
 *   2) sin gasto → longevidad MONÓTONA (días × factor, SIN techo) + bonus por
 *      impresiones/día.
 * Sin techo, el score crece siempre con los días activos: 641 días puntúa más
 * que 300 y que 89 (antes todos los de ≥89 días colapsaban a 1.068). Así el
 * número visible sirve para comparar y el orden por score coincide con la
 * antigüedad. La marca ⚪ SATURADO la decide `classifyAd` por días, no este valor;
 * los umbrales 1000/400/100 siguen aplicando a la rama de gasto.
 */
export function computeWinnerScoreFromSignals(s: WinnerSignals): number {
  const days = Number.isFinite(s.daysActive) && s.daysActive > 0 ? s.daysActive : 1;
  if (Number.isFinite(s.estimatedSpend) && s.estimatedSpend > 0) {
    return computeWinnerScore(s.estimatedSpend, s.daysActive);
  }
  // Longevidad sin techo: a más días activos, más fuerte la señal de ganador.
  const longevity = days * LONGEVITY_FACTOR;
  // Bonus por alcance: impresiones/día escaladas. Desempata anuncios de igual
  // antigüedad y, sin impresiones, suma 0 (la longevidad manda).
  const impressions = s.estimatedImpressions ?? 0;
  const reach =
    Number.isFinite(impressions) && impressions > 0
      ? (impressions / days) * IMPRESSIONS_PER_DAY_FACTOR
      : 0;
  return Math.round((longevity + reach) * 100) / 100;
}

/**
 * Clasifica un anuncio combinando el Winner Score con la antigüedad.
 * Un anuncio que lleva demasiados días activos se marca como SATURADO
 * aunque su score sea alto (el mercado puede estar maduro).
 */
export function classifyAd(
  winnerScore: number,
  daysActive: number,
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): AdClassification {
  if (daysActive >= rules.saturadoDias) return AdClassification.SATURADO;
  if (winnerScore >= rules.lanzarScore) return AdClassification.LANZAR;
  if (winnerScore >= rules.considerarScore) return AdClassification.CONSIDERAR;
  return AdClassification.MONITOREAR;
}

/** Emoji/etiqueta legible de cada clasificación, para la UI. */
export const CLASSIFICATION_META: Record<
  AdClassification,
  { emoji: string; label: string; tone: 'red' | 'yellow' | 'green' | 'gray' }
> = {
  LANZAR: { emoji: '🔴', label: 'LANZAR', tone: 'red' },
  CONSIDERAR: { emoji: '🟡', label: 'CONSIDERAR', tone: 'yellow' },
  MONITOREAR: { emoji: '🟢', label: 'MONITOREAR', tone: 'green' },
  SATURADO: { emoji: '⚪', label: 'SATURADO', tone: 'gray' },
};

/**
 * ¿El anuncio es una señal de demanda real en otro país?
 * (lleva suficientes días activo fuera de Colombia).
 */
export function isForeignDemandSignal(
  country: string,
  daysActive: number,
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): boolean {
  return country.toUpperCase() !== 'CO' && daysActive >= rules.minDiasOtroPais;
}
