import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { computeAndPersistOpportunity } from '@/lib/services/opportunity-engine';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['DETECTADO', 'VALIDADO', 'LANDING_CREADA', 'LANZADO', 'ESCALANDO']).optional(),
  market: z.string().regex(/^[A-Za-z]{2,4}$/, 'mercado inválido').optional(),
  currency: z.string().regex(/^[A-Za-z]{2,4}$/, 'moneda inválida').optional(),
  sellsInColombia: z.boolean().optional(),
  hasUnusedForeignCreative: z.boolean().optional(),
  dropiAvailability: z.enum(['DISPONIBLE', 'NO_DISPONIBLE', 'A_IMPORTAR', 'DESCONOCIDO']).optional(),
  salePrice: z.number().int().nonnegative().nullable().optional(),
  manualCost: z.number().int().nonnegative().nullable().optional(),
  shippingCost: z.number().int().nonnegative().nullable().optional(),
  saturationKeyword: z.string().trim().max(200).nullable().optional(),
  notes: z.string().optional(),
});

/**
 * Campos cuyo cambio afecta el score de oportunidad → recalcular.
 * `name` y `saturationKeyword` solo afectan la competencia de forma INDIRECTA, vía
 * la próxima medición del worker (la búsqueda usa saturationKeyword || name); el
 * costo por título se reconcilia en el siguiente cost-sync de Shopify.
 */
const OPPORTUNITY_SIGNAL_FIELDS = ['name', 'saturationKeyword', 'salePrice', 'manualCost', 'shippingCost', 'dropiAvailability', 'hasUnusedForeignCreative'] as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { ads: { include: { store: true } }, landings: { include: { images: true } }, owner: true },
  });
  if (!product) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const data: Prisma.ProductUpdateInput = { ...parsed.data };
  if (typeof data.market === 'string') data.market = data.market.toUpperCase();
  // Cambiar la keyword de saturación invalida el conteo ya medido (quedaría
  // atribuido a la keyword anterior): se nulea y la competencia cae a "estimada"
  // hasta la próxima medición del worker.
  if ('saturationKeyword' in parsed.data) {
    data.saturationCount = null;
    data.saturationUpdatedAt = null;
  }
  const product = await prisma.product.update({ where: { id: params.id }, data });
  // Si cambió una señal del score, recalcular la oportunidad (no bloquea ante fallo).
  if (OPPORTUNITY_SIGNAL_FIELDS.some((f) => f in parsed.data)) {
    await computeAndPersistOpportunity(params.id).catch((e) =>
      console.error('[product:patch:opportunity]', e instanceof Error ? e.message : e),
    );
  }
  return NextResponse.json({ product });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
