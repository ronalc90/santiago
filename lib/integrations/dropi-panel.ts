/**
 * Enlace al panel de Dropi (app.dropi.co). Es cliente-safe a propósito: NO lee
 * secretos del servidor (env validada), solo construye una URL pública, así que
 * puede importarse desde componentes cliente sin arrastrar `lib/config/env`.
 *
 * La base se puede sobreescribir con NEXT_PUBLIC_DROPI_PANEL_URL; si no, usa el
 * panel por defecto de Dropi.
 */
const DROPI_PANEL_URL =
  process.env.NEXT_PUBLIC_DROPI_PANEL_URL || 'https://app.dropi.co/dashboard/products';

// Plantilla para la ficha directa a partir del id de Dropi. Sobreescribible con
// NEXT_PUBLIC_DROPI_PRODUCT_URL por si el panel cambia de ruta.
const DROPI_PRODUCT_URL =
  process.env.NEXT_PUBLIC_DROPI_PRODUCT_URL || 'https://app.dropi.co/dashboard/product-details';

/** Enlace al panel de Dropi buscando el producto por nombre (de donde sale el dato). */
export function dropiPanelSearchUrl(query: string): string {
  return `${DROPI_PANEL_URL}?keywords=${encodeURIComponent(query.trim())}`;
}

/**
 * Mejor enlace posible a un producto del catálogo Dropi:
 *  1) la URL directa si el CSV la trajo,
 *  2) la ficha construida desde el id de Dropi,
 *  3) fallback: búsqueda por nombre en el panel.
 */
export function dropiProductUrl(item: { name: string; dropiUrl?: string | null; dropiId?: string | null }): string {
  if (item.dropiUrl?.trim()) return item.dropiUrl.trim();
  if (item.dropiId?.trim()) return `${DROPI_PRODUCT_URL}/${encodeURIComponent(item.dropiId.trim())}`;
  return dropiPanelSearchUrl(item.name);
}
