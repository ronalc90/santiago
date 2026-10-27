import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { getCurrentUser } from '@/lib/auth/session';

// Solo permitimos segmentos con caracteres seguros; rechaza '..', segmentos
// vacíos y cualquier intento de path traversal antes de tocar el storage.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

// Tipos que se pueden servir en línea desde el origen de la app. Con S3/R2 el
// Content-Type es el que se guardó, y para los videos es el que dio el servidor
// remoto (salida de Apify): un `text/html` se ejecutaría como documento en
// nuestro dominio (XSS almacenado). Cualquier otro tipo se fuerza a descarga.
const INLINE_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'video/mp4', 'video/webm', 'video/quicktime']);

/**
 * Sirve archivos guardados en el almacenamiento local durante desarrollo.
 * En producción los creativos se sirven desde R2; esta ruta (driver local) NO
 * debe quedar pública, así que exigimos sesión antes de entregar nada.
 * middleware.ts excluye /api/files a propósito: la auth se hace aquí dentro.
 */
export async function GET(_req: Request, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const segments = params.path ?? [];
  const valid =
    segments.length > 0 &&
    segments.every((s) => s !== '.' && s !== '..' && SAFE_SEGMENT.test(s));
  if (!valid) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const key = segments.join('/');
  const obj = await getStorage().get(key);
  if (!obj) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const type = obj.contentType.split(';')[0].trim().toLowerCase();
  const headers: Record<string, string> = INLINE_TYPES.has(type)
    ? { 'Content-Type': type }
    : { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment' };
  headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  return new NextResponse(new Uint8Array(obj.data), { headers });
}
