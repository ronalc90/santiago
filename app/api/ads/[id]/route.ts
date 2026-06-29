import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

// `sellsInColombia` y `hasUnusedForeignCreative` son señales DERIVADAS del anuncio
// (las setea la ingesta del spy), no input manual: NO se aceptan aquí.
const patchSchema = z.object({
  productId: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const ad = await prisma.ad.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json({ ad });
  } catch (err) {
    console.error('[ads:patch]', err);
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const ad = await prisma.ad.findUnique({ where: { id: params.id }, include: { store: true, product: true } });
  if (!ad) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ ad });
}
