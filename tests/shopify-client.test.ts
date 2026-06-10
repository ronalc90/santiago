import { describe, it, expect } from 'vitest';
import { toAdminApiProduct, isShopifyConfigured } from '../lib/shopify/client';
import { buildShopifyProduct } from '../lib/services/shopify-export';
import type { LandingInputs } from '../lib/services/landing-spec';

const inputs: LandingInputs = {
  productName: 'Masajeador Cervical',
  offerPrice: 49900,
  regularPrice: 99900,
  country: 'CO',
  currency: 'COP',
  audience: 'x',
  description: 'desc',
  offerType: '2x1',
  angle: 'a',
  sectionsCopy: [],
};
const images = [
  { slot: 1, type: 'hero', url: 'https://cdn.test/1.webp' },
  { slot: 2, type: 'precio', url: 'https://cdn.test/2.webp' },
];

describe('toAdminApiProduct', () => {
  it('mapea título, body, status, precio e imágenes con posición', () => {
    const m = toAdminApiProduct(buildShopifyProduct(inputs, images));
    expect(m.product.title).toBe('Masajeador Cervical');
    expect(m.product.status).toBe('draft');
    expect(m.product.variants[0].price).toBe('49900');
    expect(m.product.variants[0].compare_at_price).toBe('99900');
    expect(m.product.images).toHaveLength(2);
    expect(m.product.images.map((i) => i.position)).toEqual([1, 2]);
  });

  it('OMITE compare_at_price cuando no hay oferta (regular <= oferta)', () => {
    const m = toAdminApiProduct(buildShopifyProduct({ ...inputs, regularPrice: 49900 }, images));
    expect('compare_at_price' in m.product.variants[0]).toBe(false);
  });
});

describe('isShopifyConfigured', () => {
  it('es false sin credenciales en el entorno (feature desactivada)', () => {
    expect(isShopifyConfigured()).toBe(false);
  });
});
