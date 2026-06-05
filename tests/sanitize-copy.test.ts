import { describe, it, expect } from 'vitest';
import { sanitizeCopy } from '../lib/validation/ads';

describe('sanitizeCopy', () => {
  it('elimina placeholders {{...}} del anunciante', () => {
    expect(sanitizeCopy('Compra {{product.brand}} hoy')).toBe('Compra hoy');
    expect(sanitizeCopy('{{first_name}}, oferta {{product.name}} ya')).toBe(', oferta ya');
  });

  it('colapsa espacios y recorta', () => {
    expect(sanitizeCopy('  hola   mundo  ')).toBe('hola mundo');
  });

  it('devuelve null si queda vacío (o no había copy)', () => {
    expect(sanitizeCopy('{{product.brand}}')).toBeNull();
    expect(sanitizeCopy('   ')).toBeNull();
    expect(sanitizeCopy('')).toBeNull();
    expect(sanitizeCopy(null)).toBeNull();
    expect(sanitizeCopy(undefined)).toBeNull();
  });

  it('deja intacto el copy normal', () => {
    expect(sanitizeCopy('Masajeador cervical recargable')).toBe('Masajeador cervical recargable');
  });
});
