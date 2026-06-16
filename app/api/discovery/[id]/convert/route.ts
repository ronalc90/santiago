import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { computeAndPersistOpportunity } from '@/lib/services/opportunity-engine';

/** Convierte un candidato en Producto (entra al pipeline) y lo marca CONVERTIDO. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const c = await prisma.opportunityCandidate.findUnique({ where: { id: params.id } });
  if (!c) return NextResponse.json({ error: 'Candidato no encontrado' }, { status: 404 });
  if (c.productId) return NextResponse.json({ productId: c.productId, already: true });

  const product = await prisma.product.create({
    data: {
      name: c.name,
      market: 'CO',
      sellsInColombia: c.enCO,
      dropiAvailability: c.dropiStatus,
      hasUnusedForeignCreative: c.countries.some((x) => x.toUpperCase() !== 'CO') && !c.enCO,
      notes: `Desde Oportunidades · fuentes: ${c.sources.join(', ')} · países: ${c.countries.join(', ')}`,
      ownerId: auth.id,
    },
  });
  await prisma.opportunityCandidate.update({ where: { id: c.id }, data: { status: 'CONVERTIDO', productId: product.id } });
  await computeAndPersistOpportunity(product.id).catch((e) => console.error('[discovery:convert:opportunity]', e instanceof Error ? e.message : e));

  return NextResponse.json({ productId: product.id });
}
