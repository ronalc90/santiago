import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { LandingInputs } from '@/lib/services/landing-spec';
import { buildShopifyProduct, toShopifyProductCsv, landingImagesFromProject } from '@/lib/services/shopify-export';

export const runtime = 'nodejs';

/**
 * Exporta la landing como CSV de importación de Shopify (Productos → Importar):
 * un producto con precio/oferta, las 9 imágenes en la galería y la página de
 * ventas (9 imágenes apiladas + copy) en la descripción. Se importa como borrador.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const project = await prisma.landingProject.findUnique({
    where: { id: params.id },
    include: { images: { where: { status: 'COMPLETED', url: { not: null } }, orderBy: { slot: 'asc' } } },
  });
  if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const images = landingImagesFromProject(project.images);
  if (!images.length) {
    return NextResponse.json({ error: 'Aún no hay imágenes generadas' }, { status: 409 });
  }

  const inputs = project.inputs as unknown as LandingInputs;
  const product = buildShopifyProduct(inputs, images);
  // BOM (﻿) para que Shopify/Excel interpreten UTF-8 (tildes y ñ).
  const csv = '﻿' + toShopifyProductCsv(product);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="shopify-${product.handle}.csv"`,
    },
  });
}
