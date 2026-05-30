import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

/** KPIs y datos del pipeline para el dashboard. */
export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const [
    adsDetected,
    adsNew,
    productsByStatus,
    landingsGenerated,
    storesMonitored,
    productsByMarket,
  ] = await Promise.all([
    prisma.ad.count(),
    prisma.ad.count({ where: { isNew: true } }),
    prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.landingProject.count({ where: { status: 'COMPLETED' } }),
    prisma.store.count(),
    prisma.product.groupBy({ by: ['market'], _count: { _all: true } }),
  ]);

  const pipeline: Record<string, number> = {
    DETECTADO: 0, VALIDADO: 0, LANDING_CREADA: 0, LANZADO: 0, ESCALANDO: 0,
  };
  for (const row of productsByStatus) pipeline[row.status] = row._count._all;

  return NextResponse.json({
    kpis: {
      adsDetected,
      adsNew,
      productsInAnalysis: pipeline.DETECTADO + pipeline.VALIDADO,
      productsLaunched: pipeline.LANZADO + pipeline.ESCALANDO,
      landingsGenerated,
      storesMonitored,
    },
    pipeline,
    productsByMarket: productsByMarket.map((m) => ({ market: m.market, count: m._count._all })),
  });
}
