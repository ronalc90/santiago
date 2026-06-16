import { describe, it, expect, vi, afterEach } from 'vitest';

// Credenciales de app antes del primer getEnv() (memoizado en el módulo).
process.env.MELI_CLIENT_ID = 'APP_ID_123';
process.env.MELI_CLIENT_SECRET = 'SECRET_xyz';

import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  searchListingTotal,
  isMeliConfigured,
  MeliApiError,
} from '../lib/integrations/mercadolibre';
import { needsRefresh } from '../lib/services/meli';
import { competitionScore, OpportunitySignals } from '../lib/services/opportunity';
import { DEFAULT_OPPORTUNITY_RULES as R } from '../lib/services/opportunity-rules';

function res(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body } as unknown as Response;
}
function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('OAuth de MercadoLibre', () => {
  it('isMeliConfigured true con client_id + secret', () => {
    expect(isMeliConfigured()).toBe(true);
  });

  it('buildAuthorizeUrl arma la URL del sitio MCO con state y redirect', () => {
    const url = new URL(buildAuthorizeUrl('STATE123'));
    expect(url.host).toBe('auth.mercadolibre.com.co');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('APP_ID_123');
    expect(url.searchParams.get('state')).toBe('STATE123');
    expect(url.searchParams.get('redirect_uri')).toMatch(/\/api\/integrations\/meli\/callback$/);
    // offline_access es imprescindible para recibir refresh_token.
    expect(url.searchParams.get('scope')).toContain('offline_access');
  });

  it('exchangeCodeForToken normaliza la respuesta y usa grant_type=authorization_code', async () => {
    const fn = mockFetch(res({ access_token: 'AT', refresh_token: 'RT', expires_in: 21600, scope: 'read', user_id: 9988 }));
    const token = await exchangeCodeForToken('CODE');
    expect(token).toEqual({ accessToken: 'AT', refreshToken: 'RT', expiresIn: 21600, scope: 'read', userId: '9988' });
    const body = fn.mock.calls[0][1] as { body: URLSearchParams };
    expect(body.body.get('grant_type')).toBe('authorization_code');
    expect(body.body.get('code')).toBe('CODE');
  });

  it('refreshAccessToken usa grant_type=refresh_token', async () => {
    const fn = mockFetch(res({ access_token: 'AT2', refresh_token: 'RT2', expires_in: 21600 }));
    const token = await refreshAccessToken('OLD_RT');
    expect(token.accessToken).toBe('AT2');
    expect(token.refreshToken).toBe('RT2');
    const body = fn.mock.calls[0][1] as { body: URLSearchParams };
    expect(body.body.get('grant_type')).toBe('refresh_token');
    expect(body.body.get('refresh_token')).toBe('OLD_RT');
  });

  it('lanza MeliApiError si la respuesta no trae tokens', async () => {
    mockFetch(res({}));
    await expect(exchangeCodeForToken('CODE')).rejects.toBeInstanceOf(MeliApiError);
  });
});

describe('searchListingTotal (saturación)', () => {
  it('lee paging.total', async () => {
    mockFetch(res({ paging: { total: 1234 } }));
    expect(await searchListingTotal('MCO', 'masajeador', 'TOKEN')).toBe(1234);
  });

  it('0 es un valor válido (sin competencia), distinto de null', async () => {
    mockFetch(res({ paging: { total: 0 } }));
    expect(await searchListingTotal('MCO', 'nicho raro', 'TOKEN')).toBe(0);
  });

  it('sin paging → null', async () => {
    mockFetch(res({}));
    expect(await searchListingTotal('MCO', 'x', 'TOKEN')).toBeNull();
  });

  it('401 (token inválido) → null sin reintentar', async () => {
    const fn = mockFetch(res({}, { ok: false, status: 401 }));
    expect(await searchListingTotal('MCO', 'x', 'TOKEN')).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('query vacía → null sin pegar a la red', async () => {
    const fn = mockFetch(res({ paging: { total: 1 } }));
    expect(await searchListingTotal('MCO', '   ', 'TOKEN')).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('needsRefresh', () => {
  const now = 1_700_000_000_000;
  it('true si expira dentro del margen (o ya expiró)', () => {
    expect(needsRefresh(new Date(now - 1000), now)).toBe(true);
    expect(needsRefresh(new Date(now + 30_000), now)).toBe(true); // dentro del margen de 60s
  });
  it('false si falta bastante para expirar', () => {
    expect(needsRefresh(new Date(now + 3_600_000), now)).toBe(false);
  });
});

describe('saturación → dimensión Competencia', () => {
  const base: OpportunitySignals = {
    foreignAdvertisers: 0,
    foreignAds: 0,
    foreignMaxDaysActive: 0,
    foreignCountries: 0,
    coAdvertisers: 5, // hay algo de competencia (no es océano azul)
    coAds: 5,
    mlListingsCO: null,
    unitCost: null,
    shippingCost: null,
    salePrice: null,
    dropiAvailability: 'DESCONOCIDO',
    numVideos: 0,
    numImages: 0,
    maxCreativeDaysActive: 0,
    hasUnusedForeignCreative: false,
  };

  it('pocas publicaciones → mejor competencia que muchas (y no estimado)', () => {
    const pocas = competitionScore({ ...base, mlListingsCO: 10 }, R);
    const muchas = competitionScore({ ...base, mlListingsCO: 8000 }, R);
    expect(pocas.score!).toBeGreaterThan(muchas.score!);
    expect(pocas.estimated).toBe(false);
    expect(muchas.estimated).toBe(false);
  });
});
