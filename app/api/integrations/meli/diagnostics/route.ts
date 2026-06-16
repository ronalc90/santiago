import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { getEnv } from '@/lib/config/env';
import { isMeliConfigured, meliRedirectUri } from '@/lib/integrations/mercadolibre';
import { getMeliConnection } from '@/lib/services/meli';

/**
 * Diagnóstico de la integración (protegido por sesión). NO expone secretos:
 * solo confirma que APP_URL es pública, que ML está configurado y cuál es el
 * redirect_uri efectivo (para cotejarlo con el registrado en MercadoLibre).
 */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const env = getEnv();
  const appUrl = env.APP_URL;
  const isLocal = /\blocalhost\b|127\.0\.0\.1|\[::1\]/i.test(appUrl);
  const appUrlOk = /^https:\/\//i.test(appUrl) && !isLocal;
  const redirectUri = meliRedirectUri();
  const redirectUriOk = /^https:\/\//i.test(redirectUri) && !/localhost|127\.0\.0\.1/i.test(redirectUri);

  return NextResponse.json({
    appUrl,
    appUrlOk,
    meliConfigured: isMeliConfigured(),
    meliSiteId: env.MELI_SITE_ID,
    redirectUri,
    redirectUriOk,
    redirectUriExplicit: Boolean(env.MELI_REDIRECT_URI),
    connection: await getMeliConnection(),
    checkedAt: new Date().toISOString(),
  });
}
