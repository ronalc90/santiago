import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireApiUser } from '@/lib/auth/api';
import { getEnv } from '@/lib/config/env';
import { isMeliConfigured, buildAuthorizeUrl, OAUTH_STATE_COOKIE } from '@/lib/integrations/mercadolibre';

/**
 * Inicia el OAuth de MercadoLibre: genera un `state` anti-CSRF (cookie httpOnly)
 * y redirige a la pantalla de autorización. El usuario debe estar autenticado.
 */
export async function GET(_req: NextRequest) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const env = getEnv();
  if (!isMeliConfigured()) {
    const settings = new URL('/settings', env.APP_URL);
    settings.searchParams.set('meli', 'unconfigured');
    return NextResponse.redirect(settings);
  }

  const state = randomBytes(16).toString('hex');
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 min para completar el flujo
  });
  return res;
}
