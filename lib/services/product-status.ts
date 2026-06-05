import { ProductStatus } from '@prisma/client';

/**
 * Estado al que debe revertir un producto cuando se elimina una de sus landings.
 *
 * Solo revertimos si el producto estaba en LANDING_CREADA y se quedó SIN ninguna
 * landing COMPLETED: en ese caso vuelve a VALIDADO (su etapa anterior). Los
 * estados posteriores (LANZADO/ESCALANDO) no se tocan: que se borre una landing
 * no deshace un lanzamiento. Devuelve null cuando no hay que cambiar nada.
 *
 * Función pura (sin BD) para poder testear la regla de negocio aislada.
 */
export function productStatusAfterLandingRemoval(
  current: ProductStatus,
  completedLandings: number,
): ProductStatus | null {
  if (current === ProductStatus.LANDING_CREADA && completedLandings === 0) {
    return ProductStatus.VALIDADO;
  }
  return null;
}
