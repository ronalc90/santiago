import { describe, it, expect } from 'vitest';
import { ProductStatus } from '@prisma/client';
import { productStatusAfterLandingRemoval } from '../lib/services/product-status';

describe('productStatusAfterLandingRemoval', () => {
  it('revierte LANDING_CREADA → VALIDADO cuando no quedan landings completadas', () => {
    expect(productStatusAfterLandingRemoval(ProductStatus.LANDING_CREADA, 0)).toBe(ProductStatus.VALIDADO);
  });

  it('no cambia si aún quedan landings completadas', () => {
    expect(productStatusAfterLandingRemoval(ProductStatus.LANDING_CREADA, 1)).toBeNull();
  });

  it('no toca estados anteriores (VALIDADO/DETECTADO se quedan igual)', () => {
    expect(productStatusAfterLandingRemoval(ProductStatus.VALIDADO, 0)).toBeNull();
    expect(productStatusAfterLandingRemoval(ProductStatus.DETECTADO, 0)).toBeNull();
  });

  it('no revierte un lanzamiento (LANZADO/ESCALANDO) aunque se borren landings', () => {
    expect(productStatusAfterLandingRemoval(ProductStatus.LANZADO, 0)).toBeNull();
    expect(productStatusAfterLandingRemoval(ProductStatus.ESCALANDO, 0)).toBeNull();
  });
});
