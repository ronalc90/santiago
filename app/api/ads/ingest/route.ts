import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getEnv } from '@/lib/config/env';
import { normalizeIngestPayload } from '@/lib/validation/ads';
import { ingestAds } from '@/lib/services/ads';

/** Compara tokens en tiempo constante para evitar ataques de temporización. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Endpoint de ingesta del spy (lo llama la skill de Claude in Chrome).
 * Autenticación por header `x-ingest-token` que debe coincidir con INGEST_API_TOKEN.
 * Cuerpo: { ads: [...] } o un array de anuncios.
 */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    const token = req.headers.get('x-ingest-token') ?? '';
    if (!token || !safeEqual(token, env.INGEST_API_TOKEN)) {
      return NextResponse.json({ error: 'Token de ingesta inválido' }, { status: 401 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    let ads;
    try {
      ads = normalizeIngestPayload(json);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payload inválido';
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    const result = await ingestAds(ads);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[ads/ingest]', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
