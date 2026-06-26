/**
 * Velocity / momentum de un anuncio a partir de su serie temporal (AdSnapshot).
 * Puro y sin dependencias: testeable. No inventa tendencia con un solo punto.
 */
export interface VelocityPoint {
  capturedAt: Date;
  winnerScore: number;
  daysActive: number;
}

export type VelocityTrend = 'subiendo' | 'estable' | 'bajando' | 'insuficiente';

export interface VelocityResult {
  trend: VelocityTrend;
  points: number;
  /** Días entre la foto más antigua y la más reciente. */
  spanDays: number;
  /** winnerScore: más reciente − más antiguo. */
  deltaScore: number;
  /** daysActive: más reciente − más antiguo (si ~= spanDays, el anuncio sigue activo sin pausas). */
  deltaDaysActive: number;
  /** Ritmo de cambio del score por día. */
  scorePerDay: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Umbral relativo para considerar que el score sube/baja (no ruido). */
const REL_THRESHOLD = 0.05;
/** Separación mínima entre fotos para una tendencia confiable. */
const MIN_SPAN_DAYS = 0.5;

export function computeVelocity(snapshots: VelocityPoint[]): VelocityResult {
  const snaps = [...snapshots].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const points = snaps.length;
  const empty = { points, spanDays: 0, deltaScore: 0, deltaDaysActive: 0, scorePerDay: 0 };

  if (points < 2) return { trend: 'insuficiente', ...empty };

  const first = snaps[0];
  const last = snaps[points - 1];
  const spanDays = (last.capturedAt.getTime() - first.capturedAt.getTime()) / DAY_MS;
  const deltaScore = last.winnerScore - first.winnerScore;
  const deltaDaysActive = last.daysActive - first.daysActive;
  const scorePerDay = spanDays > 0 ? deltaScore / spanDays : 0;
  const base = { points, spanDays, deltaScore, deltaDaysActive, scorePerDay };

  if (spanDays < MIN_SPAN_DAYS) return { trend: 'insuficiente', ...base };

  const rel = deltaScore / Math.max(1, first.winnerScore);
  const trend: VelocityTrend = rel > REL_THRESHOLD ? 'subiendo' : rel < -REL_THRESHOLD ? 'bajando' : 'estable';
  return { trend, ...base };
}
