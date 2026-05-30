import { NextResponse } from 'next/server';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { requireApiUser } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { getStorage } from '@/lib/storage';

export const runtime = 'nodejs';

/** Descarga las 9 imágenes WebP en un .zip. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;

  const project = await prisma.landingProject.findUnique({
    where: { id: params.id },
    include: { images: { where: { status: 'COMPLETED' }, orderBy: { slot: 'asc' } } },
  });
  if (!project) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (!project.images.length) return NextResponse.json({ error: 'Aún no hay imágenes generadas' }, { status: 409 });

  const storage = getStorage();
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  for (const img of project.images) {
    if (!img.storageKey) continue;
    const obj = await storage.get(img.storageKey);
    if (obj) archive.append(obj.data, { name: `${String(img.slot).padStart(2, '0')}-${img.type}.webp` });
  }
  archive.finalize();

  // Convierte el stream Node a ReadableStream web
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="landing-${project.id}.zip"`,
    },
  });
}
