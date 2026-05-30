import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { landingCopy } from '@/lib/services/ai-copy';

export const runtime = 'nodejs';

const schema = z.object({
  inputs: z.object({
    productName: z.string().min(1, 'productName requerido'),
    country: z.string().min(2).max(4),
    audience: z.string().optional(),
    description: z.string().optional(),
    angle: z.string().optional(),
    offerType: z.string().optional(),
  }),
  complianceTiktok: z.boolean().optional().default(false),
});

/** Genera el copy de las 9 secciones de una landing (POST { inputs, complianceTiktok }). */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const copy = await landingCopy(parsed.data.inputs, parsed.data.complianceTiktok);
    return NextResponse.json({ copy });
  } catch (err) {
    console.error('[ai:landing-copy]', err);
    const message = err instanceof Error ? err.message : 'No se pudo generar el copy';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
