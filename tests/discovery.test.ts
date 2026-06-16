import { describe, it, expect } from 'vitest';
import { normalizeName } from '../lib/discovery/normalize';
import { candidateToSignals } from '../lib/discovery/score';
import { cosine } from '../lib/discovery/embeddings';
import { parseCsv } from '../lib/services/dropi-catalog';
import { computeOpportunity } from '../lib/services/opportunity';
import { DEFAULT_OPPORTUNITY_RULES as R } from '../lib/services/opportunity-rules';

describe('normalizeName (dedupe entre fuentes/países)', () => {
  it('misma clave para variantes de mayúsculas, acentos y signos', () => {
    expect(normalizeName('Masajeador Cervical')).toBe('masajeador cervical');
    expect(normalizeName('  MASAJEADOR  cervical! ')).toBe('masajeador cervical');
    expect(normalizeName('Lámpara de Luna 3D')).toBe('lampara de luna 3d');
  });
});

describe('candidateToSignals + motor 4×25', () => {
  const base = {
    countries: ['US', 'MX'],
    interest: 80,
    salesCount: null,
    listingsCount: 1200,
    daysActive: 90,
    enCO: false,
    saturationCO: null,
    numImages: 2,
    numVideos: 1,
  };

  it('candidato fuerte fuera de CO → score presente', () => {
    const r = computeOpportunity(candidateToSignals(base), R);
    expect(r.score).not.toBeNull();
  });

  it('más saturación en CO baja la dimensión Competencia', () => {
    const poca = computeOpportunity(candidateToSignals({ ...base, enCO: true, saturationCO: 50 }), R);
    const mucha = computeOpportunity(candidateToSignals({ ...base, enCO: true, saturationCO: 8000 }), R);
    expect(mucha.dimensions.competition.score!).toBeLessThan(poca.dimensions.competition.score!);
  });

  it('marca creativo extranjero sin usar cuando hay países fuera de CO y no está en CO', () => {
    const s = candidateToSignals(base);
    expect(s.hasUnusedForeignCreative).toBe(true);
    expect(s.foreignCountries).toBe(2);
  });
});

describe('parseCsv (catálogo Dropi)', () => {
  it('parsea cabecera, comillas y campos con coma', () => {
    const rows = parseCsv('name,sku,cost\n"Masajeador, Cervical",SKU1,18000\nLampara,SKU2,9000');
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Masajeador, Cervical');
    expect(rows[0].sku).toBe('SKU1');
    expect(rows[1].cost).toBe('9000');
  });
  it('devuelve [] sin filas de datos', () => {
    expect(parseCsv('name,sku')).toEqual([]);
  });
});

describe('cosine (dedupe por embeddings)', () => {
  it('1 para idénticos, 0 para ortogonales', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
});
