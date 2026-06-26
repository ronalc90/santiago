import { describe, it, expect } from 'vitest';
import {
  demandScore,
  competitionScore,
  marginScore,
  effectiveCodMargin,
  cascadeScore,
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
  unitCost: null,
  shippingCost: null,
  salePrice: null,
  dropiAvailability: 'DESCONOCIDO',
  codReturnRateOverride: null,
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
  it('nivel 1: costo real + precio → real (no estimado)', () => {
    const m = marginScore(sig({ unitCost: 20000, salePrice: 80000 }), R);
    expect(m.estimated).toBe(false);
    expect(m.score).toBeGreaterThan(40); // 75% bruto → ~52% efectivo COD
  });
  it('margen efectivo COD < bruto: las devoluciones + el recaudo recortan el score', () => {
    const bruto = marginScore(sig({ unitCost: 20000, salePrice: 80000 }), {
      ...R,
      margin: { ...R.margin, cod: { returnRate: 0, gatewayPct: 0, returnShippingRatio: 0 } },
    });
    const cod = marginScore(sig({ unitCost: 20000, salePrice: 80000 }), R);
    expect(cod.score!).toBeLessThan(bruto.score!);
  });
  it('una tasa de devolución alta puede volver el margen efectivo negativo → score 0', () => {
    const m = marginScore(sig({ unitCost: 35000, shippingCost: 12000, salePrice: 60000 }), {
      ...R,
      margin: { ...R.margin, cod: { returnRate: 0.45, gatewayPct: 0.06, returnShippingRatio: 1 } },
    });
    expect(m.score).toBe(0);
  });
  it('el costo de envío reduce el margen', () => {
    const sin = marginScore(sig({ unitCost: 20000, salePrice: 80000 }), R);
    const con = marginScore(sig({ unitCost: 20000, shippingCost: 15000, salePrice: 80000 }), R);
    expect(con.score! ).toBeLessThan(sin.score!);
    expect(con.estimated).toBe(false);
  });
  it('nivel 2: precio sin costo → estimado por ratio', () => {
    const m = marginScore(sig({ salePrice: 80000, unitCost: null }), R);
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
  it('loop de validación: una no entrega REAL alta baja el margen vs el default', () => {
    const s = { unitCost: 30000, salePrice: 90000, shippingCost: 12000 };
    const conDefault = marginScore(sig(s), R);
    const conReal = marginScore(sig({ ...s, codReturnRateOverride: 0.5 }), R);
    expect(conReal.score!).toBeLessThan(conDefault.score!);
    expect((conReal.reasons ?? []).join(' ')).toContain('REAL');
  });
});

describe('effectiveCodMargin', () => {
  const cod = { returnRate: 0.25, gatewayPct: 0.05, returnShippingRatio: 1 };

  it('descuenta recaudo y devoluciones respecto al margen bruto', () => {
    // 80k precio, 20k costo, sin envío: bruto 75% → efectivo ~52.5%.
    const eff = effectiveCodMargin(20000, 0, 80000, cod);
    expect(eff.margenPct).toBeCloseTo(0.525, 3);
    expect(eff.profitPerOrder).toBeCloseTo(42000, 0); // AOV(80k) × 52.5%
  });

  it('sin devoluciones ni recaudo coincide con el margen bruto', () => {
    const eff = effectiveCodMargin(20000, 0, 80000, { returnRate: 0, gatewayPct: 0, returnShippingRatio: 0 });
    expect(eff.margenPct).toBeCloseTo(0.75, 5);
    expect(eff.profitPerOrder).toBeCloseTo(60000, 0);
  });

  it('el flete de vuelta hunde el profit potential cuando hay devoluciones', () => {
    const sinFlete = effectiveCodMargin(20000, 15000, 80000, { ...cod, returnShippingRatio: 0 });
    const conFlete = effectiveCodMargin(20000, 15000, 80000, { ...cod, returnShippingRatio: 1 });
    expect(conFlete.profitPerOrder).toBeLessThan(sinFlete.profitPerOrder);
  });

  it('precio 0 no divide por cero', () => {
    expect(effectiveCodMargin(10000, 0, 0, cod).margenPct).toBe(0);
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

describe('cascadeScore — winner global aún sin llegar a CO', () => {
  it('null sin demanda internacional (no es un winner global)', () => {
    expect(cascadeScore(base, R).score).toBeNull();
  });

  it('alto: probado en varios países y CO casi vacío', () => {
    const c = cascadeScore(
      sig({ foreignAdvertisers: 10, foreignAds: 25, foreignMaxDaysActive: 110, foreignCountries: 3, coAdvertisers: 1, mlListingsCO: 80 }),
      R,
    );
    expect(c.score).toBeGreaterThan(60);
  });

  it('cae a ~0 cuando CO ya está saturado (la cascada ya llegó)', () => {
    const fuerte = { foreignAdvertisers: 10, foreignAds: 25, foreignMaxDaysActive: 110, foreignCountries: 3 };
    const libre = cascadeScore(sig({ ...fuerte, coAdvertisers: 0, mlListingsCO: 0 }), R);
    const saturado = cascadeScore(sig({ ...fuerte, coAdvertisers: 40, mlListingsCO: 8000 }), R);
    expect(libre.score!).toBeGreaterThan(saturado.score!);
    expect(saturado.score).toBeLessThan(10);
  });

  it('la amplitud de países sube el score (cascada geográfica)', () => {
    const unPais = cascadeScore(sig({ foreignAdvertisers: 6, foreignAds: 12, foreignMaxDaysActive: 90, foreignCountries: 1 }), R);
    const variosPaises = cascadeScore(sig({ foreignAdvertisers: 6, foreignAds: 12, foreignMaxDaysActive: 90, foreignCountries: 4 }), R);
    expect(variosPaises.score!).toBeGreaterThan(unPais.score!);
  });

  it('computeOpportunity expone el cascade junto al score 4×25', () => {
    const r = computeOpportunity(sig({ foreignAdvertisers: 8, foreignAds: 20, foreignMaxDaysActive: 100, foreignCountries: 3 }), R);
    expect(r.cascade.score).not.toBeNull();
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
        unitCost: 22000,
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
