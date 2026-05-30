import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

// Solo permitimos segmentos con caracteres seguros; rechaza '..', segmentos
// vacíos y cualquier intento de path traversal antes de tocar el storage.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Sirve archivos guardados en el almacenamiento local durante desarrollo. */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const segments = params.path ?? [];
  const valid =
    segments.length > 0 &&
    segments.every((s) => s !== '.' && s !== '..' && SAFE_SEGMENT.test(s));
  if (!valid) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const key = segments.join('/');
  const obj = await getStorage().get(key);
  if (!obj) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return new NextResponse(new Uint8Array(obj.data), {
    headers: { 'Content-Type': obj.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
