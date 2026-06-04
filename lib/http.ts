/** Tamaño máximo permitido para uploads del wizard de landing (10 MB). */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Tipos MIME de imagen aceptados para los uploads del wizard. */
const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Convierte un File (FormData) a Buffer + mimeType, o undefined si no viene.
 * Valida tamaño máximo y tipo MIME; lanza un Error claro si el archivo no
 * cumple, para que la ruta lo capture y responda con un mensaje útil.
 */
export async function fileToBuffer(file: unknown): Promise<{ data: Buffer; mimeType: string } | undefined> {
  if (!file || typeof file === 'string') return undefined;
  const f = file as File;
  if (!f.size) return undefined;

  if (f.size > MAX_UPLOAD_BYTES) {
    throw new Error(`El archivo supera el tamaño máximo de ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`);
  }

  const mimeType = f.type || 'image/png';
  if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
    throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes PNG, JPEG o WEBP.');
  }

  const ab = await f.arrayBuffer();
  return { data: Buffer.from(ab), mimeType };
}
