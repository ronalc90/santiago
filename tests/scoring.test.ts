import { describe, it, expect } from 'vitest';
import {
  computeWinnerScore,
  computeWinnerScoreFromSignals,
  longevityScore,
  classifyAd,
  isForeignDemandSignal,
  DEFAULT_SCORING_RULES,
} from '../lib/services/scoring';

/** Atajo: Winner Score por sola longevidad (sin gasto ni impresiones). */
const byLongevity = (days: number, rules = DEFAULT_SCORING_RULES) =>
  computeWinnerScoreFromSignals({ estimatedSpend: 0, daysActive: days }, rules);

/** Día (≤ horizonte) en el que la curva de longevidad alcanza su máximo. */
function peakDay(rules = DEFAULT_SCORING_RULES, horizon = 365): number {
  let best = -1;
  let bestDay = 0;
  for (let d = 1; d <= horizon; d += 1) {
    const v = byLongevity(d, rules);
    if (v > best) {
      best = v;
      bestDay = d;
    }
  }
  return bestDay;
}

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

  it('sube con la longevidad en la zona joven (3 < 30 < 60 días)', () => {
    expect(byLongevity(30)).toBeGreaterThan(byLongevity(3));
    expect(byLongevity(60)).toBeGreaterThan(byLongevity(30));
    expect(byLongevity(3)).toBeGreaterThan(0); // nunca colapsa a 0
  });

  it('tiene TECHO: pasada la zona saturada el score BAJA (más viejo = menos score)', () => {
    const d120 = byLongevity(120);
    const d300 = byLongevity(300);
    const d641 = byLongevity(641);
    expect(d120).toBeGreaterThan(d300);
    expect(d300).toBeGreaterThan(d641);
    // un anuncio veterano-pero-fresco supera a uno antiquísimo: ya no se premia
    // la antigüedad infinita (lo contrario del comportamiento anterior).
    expect(byLongevity(60)).toBeGreaterThan(d641);
  });

  it('coherencia con SATURADO: el mejor score NO está saturado y la zona saturada decrece', () => {
    const r = DEFAULT_SCORING_RULES;
    // El máximo de la curva cae ANTES del umbral de saturación.
    expect(peakDay(r)).toBeLessThan(r.saturadoDias);
    // Cualquier anuncio saturado puntúa por debajo del pico.
    const pico = byLongevity(peakDay(r));
    expect(byLongevity(r.saturadoDias)).toBeLessThan(pico);
    // Dentro de la zona saturada, a más días menos score.
    expect(byLongevity(r.saturadoDias)).toBeGreaterThan(byLongevity(r.saturadoDias + 50));
    expect(byLongevity(r.saturadoDias + 50)).toBeGreaterThan(byLongevity(r.saturadoDias + 200));
  });

  it('el pico de longevidad sigue a saturadoDias (regla configurable)', () => {
    const r30 = { ...DEFAULT_SCORING_RULES, saturadoDias: 30 };
    const pico30 = peakDay(r30, 120);
    expect(pico30).toBeLessThan(30); // siempre antes de su propia saturación
    expect(pico30).toBeGreaterThan(15); // ~0.85 × 30 ≈ 26
  });
});

describe('longevityScore', () => {
  it('alcanza su máximo (LONGEVITY_MAX = 1000) en el pico y decae después', () => {
    const peak = Math.round(DEFAULT_SCORING_RULES.saturadoDias * 0.85);
    expect(longevityScore(peak, DEFAULT_SCORING_RULES.saturadoDias)).toBeCloseTo(1000, 5);
    expect(longevityScore(peak + 1, DEFAULT_SCORING_RULES.saturadoDias)).toBeLessThan(1000);
    expect(longevityScore(peak - 1, DEFAULT_SCORING_RULES.saturadoDias)).toBeLessThan(1000);
  });

  it('trata días no válidos como 1 y saturadoDias inválido como el valor por defecto', () => {
    expect(longevityScore(0, 90)).toBe(longevityScore(1, 90));
    expect(longevityScore(50, 0)).toBe(longevityScore(50, DEFAULT_SCORING_RULES.saturadoDias));
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
