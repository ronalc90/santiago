/**
 * Constantes compartidas que NO dependen del entorno (no son secretos ni env).
 * Centralizarlas evita que el mismo valor aparezca hardcodeado en varios módulos.
 */

/** Base de la API pública de Apify (v2). La usan el descubrimiento y el ad-source. */
export const APIFY_BASE = 'https://api.apify.com/v2';

/** Tamaño de página por defecto en listados (tablas Spy/Catálogo y sus APIs). */
export const DEFAULT_PAGE_SIZE = 50;

/** Tope de page size aceptado por la API de anuncios (evita scans enormes). */
export const MAX_PAGE_SIZE = 200;
