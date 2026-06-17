import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { saveSlotIntents } from '@/lib/services/landing-slot-prompts';

const schema = z.object({ intents: z.record(z.string().max(4000)) });

/** Guarda los prompts (intención) editables por imagen de la landing (1..9). */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  const intents: Record<number, string> = {};
  for (const [k, v] of Object.entries(parsed.data.intents)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= 9) intents[n] = v;
  }
  await saveSlotIntents(intents);
  return NextResponse.json({ ok: true });
}
