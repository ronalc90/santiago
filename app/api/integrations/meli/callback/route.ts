import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { getEnv } from '@/lib/config/env';
import { isMeliConfigured, exchangeCodeForToken, OAUTH_STATE_COOKIE } from '@/lib/integrations/mercadolibre';
import { saveMeliConnection } from '@/lib/services/meli';

/**
 * Callback del OAuth: valida el `state` (anti-CSRF), intercambia el `code` por
 * tokens y los guarda CIFRADOS. Vuelve a Ajustes con un estado en la query.
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const env = getEnv();
  const redirectTo = (meli: string) => {
    const settings = new URL('/settings', env.APP_URL);
    settings.searchParams.set('meli', meli);
    const res = NextResponse.redirect(settings);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  if (!isMeliConfigured()) return redirectTo('unconfigured');

  const params = req.nextUrl.searchParams;
  if (params.get('error')) return redirectTo('denied');

  const code = params.get('code');
  const state = params.get('state');
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!state || !expected || state !== expected) return redirectTo('error');
  if (!code) return redirectTo('error');

  try {
    const token = await exchangeCodeForToken(code);
    await saveMeliConnection(token);
    return redirectTo('connected');
  } catch (e) {
    console.error('[meli:callback]', e instanceof Error ? e.message : e);
    return redirectTo('error');
  }
}
