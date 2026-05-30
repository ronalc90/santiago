import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().min(2).max(4).optional(),
  adLibraryUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const data = { ...parsed.data };
  if (data.country) data.country = data.country.toUpperCase();
  const store = await prisma.store.update({ where: { id: params.id }, data });
  return NextResponse.json({ store });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  await prisma.store.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
