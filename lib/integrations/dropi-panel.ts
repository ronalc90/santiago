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

/** Enlace al panel de Dropi buscando el producto por nombre (de donde sale el dato). */
export function dropiPanelSearchUrl(query: string): string {
  return `${DROPI_PANEL_URL}?keywords=${encodeURIComponent(query.trim())}`;
}
