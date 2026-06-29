import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { getErrorMessage } from '@/lib/errors';
import { isShopifyConfigured } from '@/lib/shopify/client';
import { syncDropiCatalogFromShopify } from '@/lib/services/dropi-catalog';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Espejo del catálogo Dropi vía Shopify: lee los productos de tu Shopify (que
 * Dropi alimenta) y los cruza con los candidatos. Camino automático soportado.
 */
export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  if (!isShopifyConfigured()) {
    return NextResponse.json(
      { error: 'Conecta Shopify primero (SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN).' },
      { status: 409 },
    );
  }
  try {
    const result = await syncDropiCatalogFromShopify();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[dropi:shopify-sync]', getErrorMessage(err));
    return NextResponse.json(
      { error: getErrorMessage(err, 'No se pudo sincronizar el catálogo desde Shopify.') },
      { status: 502 },
    );
  }
}
