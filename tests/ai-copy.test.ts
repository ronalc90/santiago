import { describe, it, expect } from 'vitest';
import { parseJsonLoose, normalizeSections } from '../lib/services/ai-copy';

describe('parseJsonLoose', () => {
  it('parsea JSON plano', () => {
    const out = parseJsonLoose<{ name: string }>('{"name":"Masajeador"}');
    expect(out.name).toBe('Masajeador');
  });

  it('parsea JSON envuelto en ```json ... ```', () => {
    const raw = 'Aquí tienes:\n```json\n{ "name": "Producto", "angle": "rápido" }\n```\n¡Listo!';
    const out = parseJsonLoose<{ name: string; angle: string }>(raw);
    expect(out.name).toBe('Producto');
    expect(out.angle).toBe('rápido');
  });

  it('recorta texto sobrante alrededor del objeto', () => {
    const out = parseJsonLoose<{ ok: boolean }>('Respuesta del modelo: {"ok": true} fin.');
    expect(out.ok).toBe(true);
  });

  it('lanza un error claro cuando no hay JSON interpretable', () => {
    expect(() => parseJsonLoose('lo siento, no puedo')).toThrow(/JSON/i);
    expect(() => parseJsonLoose('')).toThrow(/vacía/i);
  });
});

describe('normalizeSections', () => {
  it('fuerza tipos, ordena por slot y descarta slots fuera de 1..9', () => {
    const out = normalizeSections([
      { slot: 3, headline: 'Tres', bullets: ['a', '', '  b  '] },
      { slot: '1', headline: 'Uno', bullets: 'no-es-array' },
      { slot: 99, headline: 'Inválido', bullets: [] },
    ]);
    expect(out.map((s) => s.slot)).toEqual([1, 3]);
    expect(out[0].bullets).toEqual([]); // bullets no-array → []
    expect(out[1].bullets).toEqual(['a', 'b']); // recorta y descarta vacíos
  });

  it('descarta slots duplicados y tolera entradas no-array', () => {
    expect(normalizeSections('nope')).toEqual([]);
    const dup = normalizeSections([
      { slot: 1, headline: 'Primero', bullets: [] },
      { slot: 1, headline: 'Duplicado', bullets: [] },
    ]);
    expect(dup).toHaveLength(1);
    expect(dup[0].headline).toBe('Primero');
  });
});
