import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { computeAndPersistOpportunity } from '@/lib/services/opportunity-engine';

export const runtime = 'nodejs';

/** Recalcula la oportunidad de un producto (consulta ML/Dropi puntualmente). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await computeAndPersistOpportunity(params.id);
    if (!result) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    return NextResponse.json({ opportunity: result });
  } catch (err) {
    console.error('[opportunity:recompute]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'No se pudo calcular la oportunidad' }, { status: 500 });
  }
}
