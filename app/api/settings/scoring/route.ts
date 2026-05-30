import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { getScoringRules, saveScoringRules } from '@/lib/services/settings';
import { recomputeAllAds } from '@/lib/services/ads';

const rulesSchema = z.object({
  lanzarScore: z.number().nonnegative(),
  considerarScore: z.number().nonnegative(),
  monitorearScore: z.number().nonnegative(),
  saturadoDias: z.number().int().positive(),
  minDiasOtroPais: z.number().int().nonnegative(),
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const rules = await getScoringRules();
  return NextResponse.json({ rules });
}

export async function PUT(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = rulesSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  await saveScoringRules(parsed.data);
  // Al cambiar reglas, reclasificamos todos los anuncios existentes
  const recomputed = await recomputeAllAds();
  return NextResponse.json({ rules: parsed.data, recomputed });
}
