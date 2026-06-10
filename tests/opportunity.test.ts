import { describe, it, expect } from 'vitest';
import {
  demandScore,
  competitionScore,
  marginScore,
  creativesScore,
  composeOpportunity,
  classifyOpportunity,
  computeOpportunity,
  OpportunitySignals,
  DimensionResult,
} from '../lib/services/opportunity';
import { DEFAULT_OPPORTUNITY_RULES as R } from '../lib/services/opportunity-rules';

const base: OpportunitySignals = {
  foreignAdvertisers: 0,
  foreignAds: 0,
  foreignMaxDaysActive: 0,
  foreignCountries: 0,
  coAdvertisers: 0,
  coAds: 0,
  mlListingsCO: null,
  dropiCost: null,
  salePrice: null,
  dropiAvailability: 'DESCONOCIDO',
  numVideos: 0,
  numImages: 0,
  maxCreativeDaysActive: 0,
  hasUnusedForeignCreative: false,
};
const sig = (o: Partial<OpportunitySignals>): OpportunitySignals => ({ ...base, ...o });
const dim = (score: number | null, estimated = false): DimensionResult => ({ score, confidence: estimated ? 0.5 : 1, estimated, signals: {}, reasons: [] });

describe('demandScore', () => {
  it('null sin anuncios internacionales', () => {
    expect(demandScore(base, R).score).toBeNull();
  });
  it('alto con muchos anunciantes y antigüedad', () => {
    const d = demandScore(sig({ foreignAdvertisers: 12, foreignAds: 30, foreignMaxDaysActive: 120, foreignCountries: 3 }), R);
    expect(d.score).toBeGreaterThan(70);
    expect(d.estimated).toBe(false);
  });
  it('marca estimado con pocos anunciantes', () => {
    const d = demandScore(sig({ foreignAdvertisers: 1, foreignAds: 1, foreignMaxDaysActive: 6, foreignCountries: 1 }), R);
    expect(d.estimated).toBe(true);
    expect(d.confidence).toBe(0.5);
  });
});

describe('competitionScore', () => {
  it('océano azul (sin competencia) → blueOceanScore, nunca null', () => {
    const c = competitionScore(sig({ coAdvertisers: 0, mlListingsCO: 0 }), R);
    expect(c.score).toBe(R.competition.blueOceanScore);
  });
  it('mucha competencia → score bajo (inverso de saturación)', () => {
    const c = competitionScore(sig({ coAdvertisers: 40, mlListingsCO: 8000 }), R);
    expect(c.score).toBeLessThan(20);
    expect(c.estimated).toBe(false);
  });
  it('sin ML → estimado con confianza 0.5', () => {
    const c = competitionScore(sig({ coAdvertisers: 5, mlListingsCO: null }), R);
    expect(c.estimated).toBe(true);
    expect(c.confidence).toBe(0.5);
  });
});

describe('marginScore — cascada', () => {
  it('nivel 1: Dropi real + precio → real', () => {
    const m = marginScore(sig({ dropiCost: 20000, salePrice: 80000 }), R);
    expect(m.estimated).toBe(false);
    expect(m.score).toBeGreaterThan(60);
  });
  it('nivel 2: precio sin Dropi → estimado por ratio', () => {
    const m = marginScore(sig({ salePrice: 80000, dropiCost: null }), R);
    expect(m.estimated).toBe(true);
    expect(m.confidence).toBe(0.4);
    expect(m.score).not.toBeNull();
  });
  it('nivel 3: solo disponibilidad → score por disponibilidad', () => {
    const m = marginScore(sig({ dropiAvailability: 'DISPONIBLE' }), R);
    expect(m.score).toBe(R.margin.availabilityScore.DISPONIBLE);
    expect(m.estimated).toBe(true);
  });
  it('nivel 4: nada → null', () => {
    expect(marginScore(base, R).score).toBeNull();
  });
});

describe('creativesScore', () => {
  it('null sin creativos', () => {
    expect(creativesScore(base, R).score).toBeNull();
  });
  it('alto con videos + creativo extranjero sin usar', () => {
    const c = creativesScore(sig({ numVideos: 5, numImages: 6, maxCreativeDaysActive: 90, hasUnusedForeignCreative: true }), R);
    expect(c.score).toBeGreaterThan(70);
  });
});

describe('composeOpportunity — re-normalización', () => {
  it('reparte el peso de las dimensiones presentes (1 dim → ese score)', () => {
    const dims = { demand: dim(null), competition: dim(null), margin: dim(null), creatives: dim(95) };
    const c = composeOpportunity(dims, R);
    expect(c.score).toBe(95);
    expect(c.coverage).toBe(0.25);
    expect(c.presentCount).toBe(1);
  });
  it('promedia ponderado con todas presentes', () => {
    const dims = { demand: dim(80), competition: dim(60), margin: dim(40), creatives: dim(100) };
    const c = composeOpportunity(dims, R);
    expect(c.score).toBe(70); // 25/25/25/25 → media
    expect(c.confidence).toBe(1);
  });
  it('confianza baja con dimensiones estimadas', () => {
    const dims = { demand: dim(80), competition: dim(60, true), margin: dim(40, true), creatives: dim(100) };
    const c = composeOpportunity(dims, R);
    expect(c.confidence).toBeCloseTo(0.5, 5); // demand+creatives reales = 0.25+0.25
  });
});

describe('classifyOpportunity', () => {
  it('bandas con límites inclusivos', () => {
    expect(classifyOpportunity(90, R)).toBe('EXCELENTE');
    expect(classifyOpportunity(80, R)).toBe('MUY_BUENO');
    expect(classifyOpportunity(70, R)).toBe('BUENO');
    expect(classifyOpportunity(60, R)).toBe('RIESGOSO');
    expect(classifyOpportunity(59, R)).toBe('RECHAZAR');
    expect(classifyOpportunity(null, R)).toBe('SIN_DATOS');
  });
});

describe('computeOpportunity', () => {
  it('SIN_DATOS con menos de minPresent dimensiones (solo competencia, que nunca es null)', () => {
    const r = computeOpportunity(base, R); // todo vacío → solo competencia (océano azul) presente
    expect(r.band).toBe('SIN_DATOS');
    expect(r.estimated).toBe(true);
  });
  it('pesos todos en 0 → score null (no colapsa a 0/RECHAZAR)', () => {
    const rules = { ...R, weights: { demand: 0, competition: 0, margin: 0, creatives: 0 } };
    const r = computeOpportunity(
      sig({ foreignAdvertisers: 5, foreignAds: 10, foreignMaxDaysActive: 60, numVideos: 3, maxCreativeDaysActive: 60 }),
      rules,
    );
    expect(r.score).toBeNull();
    expect(r.band).toBe('SIN_DATOS');
  });

  it('gate SIN_DATOS anula también el score numérico (coherencia score↔banda)', () => {
    const r = computeOpportunity(base, R); // solo competencia presente (océano azul)
    expect(r.band).toBe('SIN_DATOS');
    expect(r.score).toBeNull();
  });

  it('blueOceanScore fuera de rango se acota a 0-100', () => {
    const rules = { ...R, competition: { ...R.competition, blueOceanScore: 150 } };
    const c = competitionScore(sig({ coAdvertisers: 0, mlListingsCO: 0 }), rules);
    expect(c.score).toBe(100);
  });

  it('producto fuerte: demanda + competencia baja + creativos → banda alta', () => {
    const r = computeOpportunity(
      sig({
        foreignAdvertisers: 10,
        foreignAds: 25,
        foreignMaxDaysActive: 110,
        foreignCountries: 3,
        coAdvertisers: 1,
        mlListingsCO: 80,
        salePrice: 90000,
        dropiCost: 22000,
        numVideos: 4,
        numImages: 5,
        maxCreativeDaysActive: 90,
        hasUnusedForeignCreative: true,
      }),
      R,
    );
    expect(r.score).not.toBeNull();
    expect(['EXCELENTE', 'MUY_BUENO', 'BUENO']).toContain(r.band);
    expect(r.coverage).toBe(1);
  });
});
