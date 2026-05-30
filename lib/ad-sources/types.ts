/**
 * Contrato de una fuente de anuncios reales (Meta Ad Library).
 *
 * Misma idea de provider que `lib/images`: una interfaz, varias implementaciones
 * (mock para dev/tests, apify para datos reales), seleccionadas por env en
 * `lib/ad-sources/index.ts`. El resto de la app (worker, servicios) depende solo
 * de esta abstracción, no del scraper concreto (Dependency Inversion).
 */

/** Parámetros de búsqueda en la Ad Library. */
export interface FetchAdsInput {
  /** País ISO-2 (CO, MX, US…). */
  country: string;
  /** Texto de búsqueda (nicho, marca, palabra clave del copy). */
  query?: string;
  /** URL de una página de competidor para traer todos sus anuncios. */
  pageUrl?: string;
  /** Máximo de anuncios a traer (acota costo pay-per-result). */
  limit: number;
}

/**
 * Anuncio crudo tal como lo entrega la fuente, antes de descargar el creativo y
 * de mapearlo al esquema de ingesta. Las URLs de media apuntan al CDN de Meta y
 * CADUCAN: hay que descargarlas de inmediato (ver `lib/services/creative.ts`).
 */
export interface RawAd {
  /** id de archivo del anuncio en Meta (clave de dedup). */
  adId: string;
  /** Nombre de la página/anunciante. */
  pageName: string;
  country: string;
  /** URL canónica a la Ad Library para este anuncio/búsqueda. */
  adLibraryUrl: string;
  copyText: string;
  ctaText?: string;
  linkUrl?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  publisherPlatforms: string[];
  /** URLs de imagen del creativo (CDN de Meta, caducan). */
  imageUrls: string[];
  /** URLs de video del creativo (CDN de Meta, caducan ~1h). */
  videoUrls: string[];
  /** Rango de impresiones [min, max] si la fuente lo expone (2026). */
  impressionsRange?: [number, number];
}

/** Contrato de la fuente de anuncios. */
export interface AdSourceProvider {
  fetchAds(input: FetchAdsInput): Promise<RawAd[]>;
}
