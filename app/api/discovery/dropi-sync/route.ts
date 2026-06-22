import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { isDropiApiConfigured } from '@/lib/integrations/dropi';
import { syncDropiCatalogFromApi } from '@/lib/services/dropi-catalog';

export const runtime = 'nodejs';
// La sincronización puede tardar (varias páginas del catálogo).
export const maxDuration = 60;

/** Trae el catálogo de Dropi por su API de Integraciones y re-cruza candidatos. */
export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  if (!isDropiApiConfigured()) {
    return NextResponse.json(
      { error: 'Falta el token de Dropi (DROPI_INTEGRATION_KEY). Genéralo en app.dropi.co → Integraciones.' },
      { status: 409 },
    );
  }
  try {
    const result = await syncDropiCatalogFromApi();
    return NextResponse.json(result);
  } catch (err) {
    console.error('[dropi:sync]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo sincronizar el catálogo de Dropi.' },
      { status: 502 },
    );
  }
}
