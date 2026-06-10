import { describe, it, expect } from 'vitest';
import { publishLandingToShopify, ShopifyNotConfiguredError } from '../lib/services/shopify-publish';

describe('publishLandingToShopify', () => {
  it('lanza ShopifyNotConfiguredError cuando Shopify no está configurado', async () => {
    // En el entorno de tests no hay SHOPIFY_STORE_DOMAIN/TOKEN → la feature está
    // desactivada y el servicio debe abortar antes de tocar la base de datos.
    await expect(publishLandingToShopify('cualquier-id')).rejects.toBeInstanceOf(ShopifyNotConfiguredError);
  });
});
