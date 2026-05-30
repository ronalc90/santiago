import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['DETECTADO', 'VALIDADO', 'LANDING_CREADA', 'LANZADO', 'ESCALANDO']).optional(),
  market: z.string().min(2).max(4).optional(),
  currency: z.string().min(2).max(4).optional(),
  sellsInColombia: z.boolean().optional(),
  hasUnusedForeignCreative: z.boolean().optional(),
  dropiAvailability: z.enum(['DISPONIBLE', 'NO_DISPONIBLE', 'A_IMPORTAR', 'DESCONOCIDO']).optional(),
  notes: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { ads: { include: { store: true } }, landings: { include: { images: true } }, owner: true },
  });
  if (!product) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const data = { ...parsed.data };
  if (data.market) data.market = data.market.toUpperCase();
  const product = await prisma.product.update({ where: { id: params.id }, data });
  return NextResponse.json({ product });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
