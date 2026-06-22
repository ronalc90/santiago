import { describe, it, expect } from 'vitest';
import { parseDropiProducts } from '@/lib/integrations/dropi';

describe('parseDropiProducts — tolerante a la forma de la respuesta', () => {
  it('extrae de un arreglo plano y mapea nombres en español', () => {
    const out = parseDropiProducts([
      { nombre: 'Masajeador Cervical', sku: 'SKU1', categoria: 'Salud', precio: '18.000', stock: '50' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Masajeador Cervical', sku: 'SKU1', category: 'Salud', cost: 18000, stock: 50 });
  });

  it('soporta envoltorios comunes ({objects}, {data:{products}})', () => {
    expect(parseDropiProducts({ objects: [{ name: 'A' }] })).toHaveLength(1);
    expect(parseDropiProducts({ data: { products: [{ name: 'B' }, { name: 'C' }] } })).toHaveLength(2);
  });

  it('ignora ítems sin nombre y saca la primera imagen de la galería', () => {
    const out = parseDropiProducts([
      { sku: 'X' }, // sin nombre → descartado
      { name: 'Lámpara', gallery: [{ url: 'http://img/1.jpg' }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].imageUrl).toBe('http://img/1.jpg');
  });

  it('respuesta vacía o no reconocida → lista vacía', () => {
    expect(parseDropiProducts({})).toEqual([]);
    expect(parseDropiProducts(null)).toEqual([]);
    expect(parseDropiProducts('nope')).toEqual([]);
  });
});
