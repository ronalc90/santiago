import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { getAllPrompts, savePrompts, PROMPT_DEFS } from '@/lib/services/prompts';

/** Devuelve la definición de cada prompt (label/descripción/default) + el valor efectivo. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const values = await getAllPrompts();
  const prompts = PROMPT_DEFS.map((d) => ({ key: d.key, label: d.label, description: d.description, default: d.default, value: values[d.key] }));
  return NextResponse.json({ prompts });
}

const bodySchema = z.object({ overrides: z.record(z.string()) });

export async function PUT(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const values = await savePrompts(parsed.data.overrides);
  return NextResponse.json({ values });
}
