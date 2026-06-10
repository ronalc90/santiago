import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import {
  publishLandingToShopify,
  ShopifyNotConfiguredError,
  LandingNotFoundError,
  NoCompletedImagesError,
  PublishInProgressError,
  ShopifyApiError,
} from '@/lib/services/shopify-publish';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Crea el producto en Shopify (Admin API) a partir de la landing. Idempotente. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await publishLandingToShopify(params.id);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof LandingNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (
      err instanceof ShopifyNotConfiguredError ||
      err instanceof NoCompletedImagesError ||
      err instanceof PublishInProgressError
    ) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof ShopifyApiError) {
      // credentials = config/autorización del operador (500), no caída de Shopify (502).
      const status =
        err.kind === 'payload' ? 422 : err.kind === 'rate_limit' ? 429 : err.kind === 'credentials' ? 500 : 502;
      return NextResponse.json({ error: `Shopify: ${err.message}` }, { status });
    }
    console.error('[shopify:publish]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No se pudo publicar en Shopify' }, { status: 500 });
  }
}
