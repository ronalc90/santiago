import { describe, it, expect } from 'vitest';
import { buildAdLibraryUrl, normalizeAdLibraryUrl } from '../lib/ad-library';

describe('buildAdLibraryUrl', () => {
  it('siempre usa ad_type=all (nunca político)', () => {
    const url = buildAdLibraryUrl({ query: 'GadgetPro', country: 'CO' });
    expect(url).toContain('ad_type=all');
    expect(url).not.toContain('political_and_issue_ads');
  });

  it('hace búsqueda por keyword cuando solo hay query', () => {
    const url = new URL(buildAdLibraryUrl({ query: 'GadgetPro CO', country: 'CO' }));
    expect(url.searchParams.get('q')).toBe('GadgetPro CO');
    expect(url.searchParams.get('search_type')).toBe('keyword_unordered');
    expect(url.searchParams.get('country')).toBe('CO');
  });

  it('usa el id de archivo cuando se conoce el anuncio', () => {
    const url = new URL(buildAdLibraryUrl({ adArchiveId: '123456789012345' }));
    expect(url.searchParams.get('id')).toBe('123456789012345');
    expect(url.searchParams.get('q')).toBeNull();
  });

  it('por defecto busca en todos los países', () => {
    const url = new URL(buildAdLibraryUrl({ query: 'x' }));
    expect(url.searchParams.get('country')).toBe('ALL');
  });
});

describe('normalizeAdLibraryUrl', () => {
  it('reescribe la vista política al modo comercial', () => {
    const politica =
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=political_and_issue_ads&country=CO&media_type=all';
    const out = normalizeAdLibraryUrl(politica, { query: 'GadgetPro CO', country: 'CO' });
    expect(out).toContain('ad_type=all');
    expect(out).not.toContain('political_and_issue_ads');
    expect(new URL(out).searchParams.get('q')).toBe('GadgetPro CO');
  });

  it('descarta ids de ejemplo no numéricos y cae a la búsqueda', () => {
    const out = normalizeAdLibraryUrl('https://www.facebook.com/ads/library/?id=AD-CO-1001', {
      query: 'GadgetPro CO',
      country: 'CO',
    });
    expect(new URL(out).searchParams.get('id')).toBeNull();
    expect(new URL(out).searchParams.get('q')).toBe('GadgetPro CO');
  });

  it('conserva un id de archivo numérico real', () => {
    const out = normalizeAdLibraryUrl('https://www.facebook.com/ads/library/?id=123456789012345');
    expect(new URL(out).searchParams.get('id')).toBe('123456789012345');
    expect(out).toContain('ad_type=all');
  });

  it('usa el fallback si la URL es inválida o vacía', () => {
    const out = normalizeAdLibraryUrl('', { query: 'FitLife Store', country: 'US' });
    expect(new URL(out).searchParams.get('q')).toBe('FitLife Store');
    expect(new URL(out).searchParams.get('country')).toBe('US');
  });
});
