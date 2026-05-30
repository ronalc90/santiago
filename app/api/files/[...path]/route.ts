import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

/** Sirve imágenes guardadas en el almacenamiento local durante desarrollo. */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const key = params.path.join('/');
  const obj = await getStorage().get(key);
  if (!obj) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return new NextResponse(new Uint8Array(obj.data), {
    headers: { 'Content-Type': obj.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
