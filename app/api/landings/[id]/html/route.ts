import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { LandingInputs } from '@/lib/services/landing-spec';
import { landingImagesFromProject } from '@/lib/services/shopify-export';
import { buildLandingHtml } from '@/lib/services/landing-html';

export const runtime = 'nodejs';

/**
 * Sirve la landing de ventas como HTML completo (capa de conversión + SEO).
 * Por defecto se muestra en el navegador; con ?download=1 se descarga como archivo.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const project = await prisma.landingProject.findUnique({
    where: { id: params.id },
    include: { images: { where: { status: 'COMPLETED', url: { not: null } }, orderBy: { slot: 'asc' } } },
  });
  if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const images = landingImagesFromProject(project.images);
  if (!images.length) return NextResponse.json({ error: 'Aún no hay imágenes generadas' }, { status: 409 });

  const inputs = project.inputs as unknown as LandingInputs;
  const html = buildLandingHtml(inputs, images);

  const download = new URL(req.url).searchParams.get('download') === '1';
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
  if (download) headers['Content-Disposition'] = `attachment; filename="landing-${project.id}.html"`;
  return new NextResponse(html, { headers });
}
