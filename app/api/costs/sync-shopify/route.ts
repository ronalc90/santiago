import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { isShopifyConfigured } from '@/lib/shopify/client';
import { enqueueCostSyncJob } from '@/lib/queue';

export const runtime = 'nodejs';

/**
 * Dispara la sincronización de costos desde Shopify en el worker (no bloquea la UI).
 * Devuelve 202; el worker hace el trabajo y deja el resumen en el estado de sync.
 */
export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: 'Shopify no está configurado.' }, { status: 409 });
  }
  try {
    const jobId = await enqueueCostSyncJob();
    return NextResponse.json({ ok: true, jobId, queued: true }, { status: 202 });
  } catch (err) {
    console.error('[costs:sync-shopify]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No se pudo encolar la sincronización' }, { status: 500 });
  }
}
