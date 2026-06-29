import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { getErrorMessage } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { suggestProduct } from '@/lib/services/ai-copy';

export const runtime = 'nodejs';

const schema = z.object({ adId: z.string().min(1, 'adId requerido') });

/** Sugiere una ficha de producto a partir del copy de un anuncio (POST { adId }). */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const ad = await prisma.ad.findUnique({ where: { id: parsed.data.adId } });
    if (!ad) return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 });

    const suggestion = await suggestProduct(ad.copyText ?? '', ad.country);
    return NextResponse.json({ suggestion });
  } catch (err) {
    console.error('[ai:suggest-product]', err);
    const message = getErrorMessage(err, 'No se pudo generar la sugerencia');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
