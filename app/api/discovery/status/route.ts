import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { getDiscoveryQueue } from '@/lib/queue';
import { getDiscoveryStatus } from '@/lib/services/discovery';

/** Estado del descubrimiento para el indicador de progreso de la UI. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  let running = false;
  try {
    const c = await getDiscoveryQueue().getJobCounts('active', 'waiting', 'delayed', 'paused');
    running = (c.active ?? 0) + (c.waiting ?? 0) + (c.delayed ?? 0) + (c.paused ?? 0) > 0;
  } catch {
    /* Redis no disponible → running:false */
  }
  return NextResponse.json({ running, status: await getDiscoveryStatus() });
}
