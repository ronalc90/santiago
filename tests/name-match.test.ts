import { describe, it, expect } from 'vitest';
import { nameSimilarity, namesMatch } from '@/lib/discovery/name-match';

describe('namesMatch — cruce catálogo Dropi ↔ candidatos', () => {
  it('cruza un título verboso de ML con el nombre corto del catálogo (el bug reportado)', () => {
    expect(namesMatch('masajeador cervical electrico 3d recargable', 'masajeador cervical')).toBe(true);
  });

  it('coincidencia exacta siempre cruza', () => {
    expect(namesMatch('lampara de luna', 'lampara de luna')).toBe(true);
  });

  it('una sola palabra compartida NO cruza (evita falsos por palabra genérica)', () => {
    expect(namesMatch('reloj inteligente deportivo', 'reloj de pared vintage')).toBe(false);
  });

  it('contención: nombre corto contenido en el largo → score 1', () => {
    expect(nameSimilarity('a b', 'a b c d')).toEqual({ score: 1, shared: 2 });
  });
});
