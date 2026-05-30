/**
 * Utilidades para enlazar a la Meta (Facebook) Ad Library.
 *
 * Problema que resuelve: si se abre la Ad Library sin `ad_type` —o con un `id`
 * que Meta no logra resolver— Meta redirige a su vista por defecto de anuncios
 * POLÍTICOS (`ad_type=political_and_issue_ads`). Estas funciones garantizan que
 * los enlaces siempre apunten a la biblioteca COMERCIAL (`ad_type=all`).
 *
 * Es código puro (solo usa `URL`/`URLSearchParams`), por lo que puede usarse
 * tanto en componentes de servidor como de cliente.
 */

const AD_LIBRARY_BASE = 'https://www.facebook.com/ads/library/';

export interface AdLibraryQuery {
  /** Texto de búsqueda: nombre de la tienda/marca o palabra clave del copy. */
  query?: string;
  /** País ISO-2 (CO, MX, US…). Por defecto 'ALL' (todos los países). */
  country?: string;
  /** ID de archivo del anuncio (numérico) cuando se conoce el anuncio exacto. */
  adArchiveId?: string;
  /** ID de página de Facebook para ver todos los anuncios de esa página. */
  pageId?: string;
}

/** Indica si un `id` parece un archive id real de Meta (numérico y largo). */
function isRealArchiveId(id: string | null | undefined): id is string {
  return !!id && /^\d{5,}$/.test(id);
}

/** true si la URL apunta a la Ad Library de Facebook (host + ruta válidos). */
export function isAdLibraryUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.protocol === 'https:' || u.protocol === 'http:') &&
      /(^|\.)facebook\.com$/.test(u.hostname) &&
      u.pathname.startsWith('/ads/library')
    );
  } catch {
    return false;
  }
}

/**
 * Construye una URL válida de la Ad Library que SIEMPRE muestra anuncios
 * comerciales (`ad_type=all`), nunca la vista de anuncios políticos.
 */
export function buildAdLibraryUrl({ query, country, adArchiveId, pageId }: AdLibraryQuery): string {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all', // ← clave: evita el redirect a political_and_issue_ads
    country: (country || 'ALL').toUpperCase(),
    media_type: 'all',
  });

  if (adArchiveId) {
    params.set('id', adArchiveId);
  } else if (pageId) {
    params.set('view_all_page_id', pageId);
  } else if (query && query.trim()) {
    params.set('q', query.trim());
    params.set('search_type', 'keyword_unordered');
  }

  return `${AD_LIBRARY_BASE}?${params.toString()}`;
}

/**
 * Normaliza una URL de Ad Library ya almacenada para garantizar que abra la
 * biblioteca comercial. Conserva el anuncio/página si la URL trae datos útiles
 * (id numérico real, view_all_page_id o q); si no, reconstruye una búsqueda
 * con `fallback` (típicamente el nombre de la tienda + país).
 */
export function normalizeAdLibraryUrl(
  url: string | null | undefined,
  fallback: AdLibraryQuery = {},
): string {
  if (url) {
    try {
      const u = new URL(url);
      const isAdLibrary =
        /(^|\.)facebook\.com$/.test(u.hostname) && u.pathname.startsWith('/ads/library');
      if (isAdLibrary) {
        const id = u.searchParams.get('id');
        const pageId = u.searchParams.get('view_all_page_id') ?? undefined;
        const q = u.searchParams.get('q') ?? undefined;
        const country = u.searchParams.get('country') ?? fallback.country;
        if (isRealArchiveId(id) || pageId || q) {
          return buildAdLibraryUrl({
            adArchiveId: isRealArchiveId(id) ? id : undefined,
            pageId,
            query: q ?? fallback.query,
            country,
          });
        }
      }
    } catch {
      /* URL inválida → caemos al fallback */
    }
  }
  return buildAdLibraryUrl(fallback);
}
