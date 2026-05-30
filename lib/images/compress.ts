import sharp from 'sharp';

export interface CompressedImage {
  data: Buffer;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Comprime una imagen a WebP optimizado para Shopify:
 *  - lado máximo 2000px
 *  - objetivo ~200KB (baja la calidad iterativamente hasta acercarse)
 */
export async function compressToWebp(input: Buffer, targetBytes = 200_000, maxSide = 2000): Promise<CompressedImage> {
  const base = sharp(input).resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });
  let quality = 82;
  let out = await base.clone().webp({ quality }).toBuffer();

  // Reduce calidad hasta acercarse al objetivo (mínimo 45 para no degradar demasiado)
  while (out.length > targetBytes && quality > 45) {
    quality -= 10;
    out = await base.clone().webp({ quality }).toBuffer();
  }

  const meta = await sharp(out).metadata();
  return { data: out, width: meta.width ?? 0, height: meta.height ?? 0, bytes: out.length };
}
