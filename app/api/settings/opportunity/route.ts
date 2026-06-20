import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { getOpportunityRules, saveOpportunityRules } from '@/lib/services/settings';
import { DEFAULT_OPPORTUNITY_RULES } from '@/lib/services/opportunity-rules';
import { recomputeAllProductsOpportunity } from '@/lib/services/opportunity-engine';

export const runtime = 'nodejs';
// Red de seguridad ante el límite serverless: el PUT recalcula todos los productos.
export const maxDuration = 60;

const num = z.number();
const score100 = z.number().min(0).max(100);
const nullableScore = score100.nullable();

const rulesSchema = z.object({
  weights: z
    .object({ demand: num.nonnegative(), competition: num.nonnegative(), margin: num.nonnegative(), creatives: num.nonnegative() })
    .refine((w) => w.demand + w.competition + w.margin + w.creatives > 0, { message: 'Al menos un peso debe ser mayor que 0' }),
  bands: z
    .object({ excelente: score100, muyBueno: score100, bueno: score100, riesgoso: score100 })
    .refine((b) => b.excelente >= b.muyBueno && b.muyBueno >= b.bueno && b.bueno >= b.riesgoso, {
      message: 'Las bandas deben ser descendentes: excelente ≥ muy bueno ≥ bueno ≥ riesgoso',
    }),
  minPresent: z.number().int().min(1).max(4),
  minConfidence: z.number().min(0).max(1),
  demand: z.object({ advertisersHi: num, adsHi: num, ageLo: num, ageHi: num, breadthHi: num }),
  competition: z.object({ mlLo: num, mlHi: num, coAdvertisersHi: num, blueOceanScore: score100, mlWeight: num.min(0).max(1) }),
  margin: z.object({
    marginLo: num, marginHi: num, roiLo: num, roiHi: num, costRatioDefault: num.min(0).max(1),
    availabilityScore: z.object({ DISPONIBLE: nullableScore, A_IMPORTAR: nullableScore, NO_DISPONIBLE: nullableScore, DESCONOCIDO: nullableScore }),
    // Opcional: clientes previos al deploy no lo envían; al leer, getOpportunityRules
    // re-inyecta el default vía deepMerge, así que persistir sin `cod` es seguro.
    cod: z.object({ returnRate: num.min(0).max(1), gatewayPct: num.min(0).max(1), returnShippingRatio: num.min(0) }).optional(),
  }),
  creatives: z.object({ videosHi: num, creativesHi: num, provenLo: num, provenHi: num, unusedBonus: num }),
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rules: await getOpportunityRules() });
}

export async function PUT(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = rulesSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  // Si el cliente no envió `cod` (versión previa al deploy), usamos el default.
  const rules = {
    ...parsed.data,
    margin: { ...parsed.data.margin, cod: parsed.data.margin.cod ?? DEFAULT_OPPORTUNITY_RULES.margin.cod },
  };
  await saveOpportunityRules(rules);
  const recomputed = await recomputeAllProductsOpportunity();
  return NextResponse.json({ rules, recomputed });
}
