import { describe, it, expect } from 'vitest';
import { computeVelocity, type VelocityPoint } from '@/lib/services/velocity';

const d = (iso: string) => new Date(iso);
const pt = (iso: string, winnerScore: number, daysActive: number): VelocityPoint => ({ capturedAt: d(iso), winnerScore, daysActive });

describe('computeVelocity', () => {
  it('una sola foto → insuficiente (no inventa tendencia)', () => {
    expect(computeVelocity([pt('2026-06-01', 1000, 10)]).trend).toBe('insuficiente');
  });

  it('dos fotos el mismo día (span < 0.5) → insuficiente', () => {
    const r = computeVelocity([pt('2026-06-01T08:00', 1000, 10), pt('2026-06-01T12:00', 1200, 10)]);
    expect(r.trend).toBe('insuficiente');
  });

  it('score sube >5% en varios días → subiendo', () => {
    const r = computeVelocity([pt('2026-06-01', 1000, 10), pt('2026-06-05', 1300, 14)]);
    expect(r.trend).toBe('subiendo');
    expect(r.deltaScore).toBe(300);
    expect(r.deltaDaysActive).toBe(4);
    expect(r.spanDays).toBe(4);
  });

  it('score baja >5% → bajando', () => {
    expect(computeVelocity([pt('2026-06-01', 1000, 10), pt('2026-06-04', 800, 13)]).trend).toBe('bajando');
  });

  it('cambio pequeño (<5%) → estable', () => {
    expect(computeVelocity([pt('2026-06-01', 1000, 10), pt('2026-06-03', 1020, 12)]).trend).toBe('estable');
  });

  it('ordena por fecha aunque vengan desordenadas', () => {
    const r = computeVelocity([pt('2026-06-05', 1300, 14), pt('2026-06-01', 1000, 10)]);
    expect(r.deltaScore).toBe(300);
    expect(r.trend).toBe('subiendo');
  });
});
