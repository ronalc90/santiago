import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { computeAndPersistOpportunity } from '@/lib/services/opportunity-engine';

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  market: z.string().regex(/^[A-Za-z]{2,4}$/, 'mercado inválido').default('CO'),
  currency: z.string().regex(/^[A-Za-z]{2,4}$/, 'moneda inválida').default('COP'),
  sellsInColombia: z.boolean().optional(),
  hasUnusedForeignCreative: z.boolean().optional(),
  dropiAvailability: z.enum(['DISPONIBLE', 'NO_DISPONIBLE', 'A_IMPORTAR', 'DESCONOCIDO']).optional(),
  notes: z.string().optional(),
  fromAdId: z.string().optional(), // crear producto a partir de un anuncio
});

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const where: Record<string, unknown> = {};
  const status = searchParams.get('status');
  const market = searchParams.get('market');
  if (status) where.status = status;
  if (market) where.market = market.toUpperCase();
  const products = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { ads: true, landings: true, owner: true },
  });
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { fromAdId, ...data } = parsed.data;
    const product = await prisma.product.create({
      data: { ...data, market: data.market.toUpperCase(), ownerId: auth.id },
    });
    // Si viene de un anuncio, lo ligamos
    if (fromAdId) {
      await prisma.ad.update({ where: { id: fromAdId }, data: { productId: product.id } }).catch(() => {});
    }
    // Calcula la oportunidad inicial (con el anuncio ya ligado). No bloquea ante fallo.
    await computeAndPersistOpportunity(product.id).catch((e) =>
      console.error('[product:create:opportunity]', e instanceof Error ? e.message : e),
    );
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('[products:create]', err);
    return NextResponse.json({ error: 'No se pudo crear el producto' }, { status: 500 });
  }
}
