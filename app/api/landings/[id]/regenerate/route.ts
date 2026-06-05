import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { regenerateImage, regenerateAllImages } from '@/lib/services/landing';

// Acepta { slot: 1..9 } para una sola imagen o { all: true } para las 9.
const schema = z.union([
  z.object({ slot: z.number().int().min(1).max(9) }),
  z.object({ all: z.literal(true) }),
]);

/** Regenera una sola imagen (slot 1..9) o todas ({ all: true }). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    if ('all' in parsed.data) await regenerateAllImages(params.id);
    else await regenerateImage(params.id, parsed.data.slot);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
