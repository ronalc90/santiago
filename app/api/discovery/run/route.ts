import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { enqueueDiscoveryJob } from '@/lib/queue';

/** Dispara una corrida de descubrimiento en el worker (no bloquea la UI). */
export async function POST() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const jobId = await enqueueDiscoveryJob();
  return NextResponse.json({ jobId }, { status: 202 });
}
