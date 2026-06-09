import { describe, it, expect } from 'vitest';
import { buildShopifyProduct, toShopifyProductCsv } from '../lib/services/shopify-export';
import type { LandingInputs } from '../lib/services/landing-spec';

const inputs: LandingInputs = {
  productName: 'Masajeador Cervical Recargable',
  offerPrice: 49900,
  regularPrice: 99900,
  country: 'CO',
  currency: 'COP',
  audience: 'Adultos con dolor de cuello',
  description: 'Alivio rápido del dolor cervical en casa.',
  offerType: '2x1',
  angle: 'Alivio sin fisioterapeuta',
  sectionsCopy: [{ slot: 5, headline: 'Beneficios', bullets: ['Alivia el dolor', 'Portátil'] }],
};

const images = [
  { slot: 2, type: 'precio', url: 'https://cdn.test/img-2.webp' },
  { slot: 1, type: 'hero', url: 'https://cdn.test/img-1.webp' },
];

describe('buildShopifyProduct', () => {
  it('arma título, handle y precios (compare-at solo si regular > oferta)', () => {
    const p = buildShopifyProduct(inputs, images);
    expect(p.title).toBe('Masajeador Cervical Recargable');
    expect(p.handle).toBe('masajeador-cervical-recargable');
    expect(p.price).toBe('49900');
    expect(p.compareAtPrice).toBe('99900');
    expect(p.status).toBe('draft');
  });

  it('ordena las imágenes por slot y numera posiciones', () => {
    const p = buildShopifyProduct(inputs, images);
    expect(p.images.map((i) => i.src)).toEqual(['https://cdn.test/img-1.webp', 'https://cdn.test/img-2.webp']);
    expect(p.images.map((i) => i.position)).toEqual([1, 2]);
  });

  it('apila las imágenes y el copy en el body HTML', () => {
    const p = buildShopifyProduct(inputs, images);
    expect(p.bodyHtml).toContain('https://cdn.test/img-1.webp');
    expect(p.bodyHtml).toContain('Alivio rápido del dolor cervical');
    expect(p.bodyHtml).toContain('Alivia el dolor');
  });

  it('no pone compare-at si la oferta no es menor que el regular', () => {
    const p = buildShopifyProduct({ ...inputs, regularPrice: 49900 }, images);
    expect(p.compareAtPrice).toBe('');
  });
});

describe('toShopifyProductCsv', () => {
  it('genera cabecera, fila de producto y filas extra por imagen', () => {
    const csv = toShopifyProductCsv(buildShopifyProduct(inputs, images));
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Handle');
    expect(lines[0]).toContain('Image Src');
    // 1 cabecera + 1 producto + 1 imagen extra (2 imágenes) = 3 líneas
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Masajeador Cervical Recargable');
  });

  it('escapa celdas con comas/comillas/saltos (body HTML entre comillas dobles)', () => {
    const csv = toShopifyProductCsv(buildShopifyProduct(inputs, images));
    // El body HTML tiene comas/comillas → debe ir entre comillas dobles.
    expect(csv).toContain('"<div');
  });
});
