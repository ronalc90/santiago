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
  const redirectTo = (meli: string, reason?: string) => {
    const settings = new URL('/settings', env.APP_URL);
    settings.searchParams.set('meli', meli);
    if (reason) settings.searchParams.set('reason', reason);
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
  if (!state || !expected || state !== expected) {
    // Cookie de state ausente o distinta: típicamente el "connect" se abrió en otro
    // dominio (deployment URL ≠ APP_URL) o tardó >10 min en autorizar.
    console.error(`[meli:callback] state inválido (state=${state ? 'present' : 'ausente'}, cookie=${expected ? 'present' : 'ausente'})`);
    return redirectTo('error', 'state');
  }
  if (!code) return redirectTo('error', 'nocode');

  try {
    const token = await exchangeCodeForToken(code);
    await saveMeliConnection(token);
    return redirectTo('connected');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[meli:callback] intercambio falló:', msg);
    // El detalle (p. ej. "respondió 400 (invalid_grant: …)") no es secreto: lo
    // dejamos en la URL para diagnosticar sin depender de los logs.
    return redirectTo('error', msg.slice(0, 180));
  }
}
