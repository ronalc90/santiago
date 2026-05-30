import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

/** Estado del proyecto + imágenes + progreso del job (para polling de la UI). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  const project = await prisma.landingProject.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { slot: 'asc' } }, jobs: { orderBy: { createdAt: 'desc' }, take: 1 }, product: true },
  });
  if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const progress = project.jobs[0]?.progress ?? 0;
  return NextResponse.json({ project, progress });
}
