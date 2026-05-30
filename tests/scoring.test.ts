import { describe, it, expect } from 'vitest';
import {
  computeWinnerScore,
  computeWinnerScoreFromSignals,
  classifyAd,
  isForeignDemandSignal,
  DEFAULT_SCORING_RULES,
} from '../lib/services/scoring';

describe('computeWinnerScore', () => {
  it('divide gasto entre días activos', () => {
    expect(computeWinnerScore(10000, 10)).toBe(1000);
    expect(computeWinnerScore(900, 3)).toBe(300);
  });

  it('trata 0 días como 1 para no dividir por cero', () => {
    expect(computeWinnerScore(500, 0)).toBe(500);
  });

  it('devuelve 0 con gasto inválido o negativo', () => {
    expect(computeWinnerScore(0, 5)).toBe(0);
    expect(computeWinnerScore(-100, 5)).toBe(0);
    expect(computeWinnerScore(NaN, 5)).toBe(0);
  });

  it('redondea a 2 decimales', () => {
    expect(computeWinnerScore(1000, 3)).toBe(333.33);
  });
});

describe('computeWinnerScoreFromSignals', () => {
  it('usa gasto/día cuando hay gasto real (igual que la fórmula clásica)', () => {
    expect(computeWinnerScoreFromSignals({ estimatedSpend: 10000, daysActive: 10 })).toBe(1000);
  });

  it('sin gasto pero con impresiones, ordena por impresiones/día', () => {
    const pocas = computeWinnerScoreFromSignals({ estimatedSpend: 0, daysActive: 10, estimatedImpressions: 50000 });
    const muchas = computeWinnerScoreFromSignals({ estimatedSpend: 0, daysActive: 10, estimatedImpressions: 200000 });
    expect(muchas).toBeGreaterThan(pocas);
    expect(pocas).toBeGreaterThan(0);
  });

  it('sin gasto ni impresiones, ordena por longevidad (más días = más score)', () => {
    const nuevo = computeWinnerScoreFromSignals({ estimatedSpend: 0, daysActive: 3 });
    const viejo = computeWinnerScoreFromSignals({ estimatedSpend: 0, daysActive: 45 });
    expect(viejo).toBeGreaterThan(nuevo);
    expect(nuevo).toBeGreaterThan(0); // ya no colapsa a 0
  });

  it('acota la longevidad por debajo del umbral de SATURADO', () => {
    const cap = computeWinnerScoreFromSignals({ estimatedSpend: 0, daysActive: 500 });
    const justoAntes = computeWinnerScoreFromSignals({ estimatedSpend: 0, daysActive: DEFAULT_SCORING_RULES.saturadoDias - 1 });
    expect(cap).toBe(justoAntes);
  });
});

describe('classifyAd', () => {
  const r = DEFAULT_SCORING_RULES; // lanzar>=1000, considerar>=400, saturado>=90 días

  it('marca SATURADO cuando supera los días máximos, aunque el score sea alto', () => {
    expect(classifyAd(5000, 120, r)).toBe('SATURADO');
  });

  it('LANZAR con score alto y pocos días', () => {
    expect(classifyAd(1500, 10, r)).toBe('LANZAR');
    expect(classifyAd(1000, 10, r)).toBe('LANZAR'); // límite inclusivo
  });

  it('CONSIDERAR en rango medio', () => {
    expect(classifyAd(500, 10, r)).toBe('CONSIDERAR');
    expect(classifyAd(400, 10, r)).toBe('CONSIDERAR'); // límite inclusivo
  });

  it('MONITOREAR por debajo del umbral de considerar', () => {
    expect(classifyAd(399, 10, r)).toBe('MONITOREAR');
    expect(classifyAd(0, 1, r)).toBe('MONITOREAR');
  });

  it('respeta reglas personalizadas', () => {
    const custom = { ...r, lanzarScore: 200, saturadoDias: 30 };
    expect(classifyAd(250, 5, custom)).toBe('LANZAR');
    expect(classifyAd(250, 35, custom)).toBe('SATURADO');
  });
});

describe('isForeignDemandSignal', () => {
  it('es señal si está fuera de CO con +5 días', () => {
    expect(isForeignDemandSignal('MX', 6)).toBe(true);
    expect(isForeignDemandSignal('US', 5)).toBe(true);
  });

  it('no es señal dentro de CO', () => {
    expect(isForeignDemandSignal('CO', 30)).toBe(false);
  });

  it('no es señal con pocos días en el extranjero', () => {
    expect(isForeignDemandSignal('MX', 4)).toBe(false);
  });
});
