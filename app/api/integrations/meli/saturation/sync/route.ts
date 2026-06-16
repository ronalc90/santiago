import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { isMeliConfigured } from '@/lib/integrations/mercadolibre';
import { enqueueMeliSaturationJob } from '@/lib/queue';

/** Dispara la medición de saturación en el worker (no bloquea la UI). */
export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  if (!isMeliConfigured()) {
    return NextResponse.json({ error: 'MercadoLibre no está configurado.' }, { status: 409 });
  }
  const jobId = await enqueueMeliSaturationJob();
  return NextResponse.json({ jobId }, { status: 202 });
}
