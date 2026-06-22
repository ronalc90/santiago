import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { THEMES } from '@/lib/theme';

export const runtime = 'nodejs';

const bodySchema = z.object({ theme: z.enum(THEMES) });

/** Guarda la preferencia de apariencia del usuario autenticado (permanente). */
export async function PUT(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Tema inválido' }, { status: 400 });
  await prisma.user.update({ where: { id: auth.id }, data: { theme: parsed.data.theme } });
  return NextResponse.json({ theme: parsed.data.theme });
}
