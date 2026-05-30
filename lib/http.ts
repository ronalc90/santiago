/** Convierte un File (FormData) a Buffer + mimeType, o null si no viene. */
export async function fileToBuffer(file: unknown): Promise<{ data: Buffer; mimeType: string } | undefined> {
  if (!file || typeof file === 'string') return undefined;
  const f = file as File;
  if (!f.size) return undefined;
  const ab = await f.arrayBuffer();
  return { data: Buffer.from(ab), mimeType: f.type || 'image/png' };
}
