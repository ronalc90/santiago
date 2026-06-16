import { describe, it, expect } from 'vitest';
import { matchShopifyCost, normalizeTitle } from '../lib/services/cost-sync';
import type { ShopifyCostRow } from '../lib/shopify/client';

const row = (o: Partial<ShopifyCostRow>): ShopifyCostRow => ({
  shopifyProductId: '1',
  title: 'Producto',
  handle: 'producto',
  sku: null,
  unitCost: 20000,
  ...o,
});

describe('matchShopifyCost', () => {
  const linked = row({ shopifyProductId: '111', title: 'Otro título', unitCost: 30000 });
  const byTitleRow = row({ shopifyProductId: '222', title: 'Masajeador Cervical', unitCost: 25000 });
  const byShopifyId = new Map([['111', linked]]);
  const byTitle = new Map([['masajeador cervical', byTitleRow], ['otro título', linked]]);

  it('empareja por el vínculo de publicación (landing.shopifyProductId)', () => {
    const m = matchShopifyCost({ name: 'No importa', landings: [{ shopifyProductId: '111' }] }, byShopifyId, byTitle);
    expect(m).toBe(linked);
  });

  it('empareja por título (case-insensitive) si no hay vínculo', () => {
    const m = matchShopifyCost({ name: 'masajeador cervical', landings: [] }, byShopifyId, byTitle);
    expect(m).toBe(byTitleRow);
  });

  it('el vínculo tiene prioridad sobre el título', () => {
    const m = matchShopifyCost({ name: 'Masajeador Cervical', landings: [{ shopifyProductId: '111' }] }, byShopifyId, byTitle);
    expect(m).toBe(linked);
  });

  it('devuelve undefined si no hay match', () => {
    const m = matchShopifyCost({ name: 'Inexistente', landings: [{ shopifyProductId: '999' }] }, byShopifyId, byTitle);
    expect(m).toBeUndefined();
  });

  it('NO empareja por título si el título es ambiguo (duplicado en Shopify)', () => {
    const ambiguous = new Set(['masajeador cervical']);
    const m = matchShopifyCost({ name: 'Masajeador Cervical', landings: [] }, byShopifyId, byTitle, ambiguous);
    expect(m).toBeUndefined();
  });

  it('empareja por título ignorando acentos y espacios extra', () => {
    const acento = row({ shopifyProductId: '333', title: 'Báscula Digital', unitCost: 18000 });
    const map = new Map([[normalizeTitle('Báscula Digital'), acento]]);
    const m = matchShopifyCost({ name: '  Bascula   Digital ', landings: [] }, byShopifyId, map);
    expect(m).toBe(acento);
  });
});

describe('normalizeTitle', () => {
  it('quita acentos, baja a minúsculas y colapsa espacios', () => {
    expect(normalizeTitle('  Báscula   DIGITAL ')).toBe('bascula digital');
    expect(normalizeTitle('Masajeador Cervical')).toBe('masajeador cervical');
  });
});
