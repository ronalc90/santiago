import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

const createSchema = z.object({
  name: z.string().min(1),
  country: z.string().min(2).max(4).default('CO'),
  adLibraryUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { ads: true } } },
  });
  return NextResponse.json({ stores });
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { name, country, adLibraryUrl, notes } = parsed.data;
    const store = await prisma.store.create({
      data: { name, country: country.toUpperCase(), adLibraryUrl: adLibraryUrl || null, notes },
    });
    return NextResponse.json({ store }, { status: 201 });
  } catch (err) {
    console.error('[stores:create]', err);
    return NextResponse.json({ error: 'No se pudo crear (¿nombre+país duplicado?)' }, { status: 409 });
  }
}
