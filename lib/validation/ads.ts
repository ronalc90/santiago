import { z } from 'zod';

/**
 * Esquema de un anuncio tal como lo envía la skill del spy (snake_case).
 * Tolerante: acepta strings para números y fechas opcionales.
 */
export const ingestAdSchema = z.object({
  store_name: z.string().min(1, 'store_name requerido'),
  country: z.string().min(2).max(4).default('CO'),
  ad_id: z.string().min(1, 'ad_id requerido'),
  ad_library_url: z.string().url('ad_library_url debe ser URL'),
  copy_text: z.string().optional().default(''),
  days_active: z.coerce.number().int().nonnegative().default(0),
  estimated_spend: z.coerce.number().nonnegative().default(0),
  creative_url: z.string().url().optional().or(z.literal('')).default(''),
  // Magnitud de exposición (no es gasto): punto medio del rango de impresiones
  // cuando la fuente lo expone. Alimenta el Winner Score cuando no hay gasto.
  estimated_impressions: z.coerce.number().nonnegative().optional(),
  detected_at: z.coerce.date().optional(),
  // Señales opcionales que el spy puede marcar
  sells_in_colombia: z.coerce.boolean().optional(),
  has_unused_foreign_creative: z.coerce.boolean().optional(),
  // Metadatos reales opcionales (Ad Library). Se conservan en `raw` para
  // auditoría; no requieren columnas en la base de datos.
  cta_text: z.string().optional(),
  link_url: z.string().url().optional().or(z.literal('')),
  publisher_platforms: z.array(z.string()).optional(),
  is_active: z.coerce.boolean().optional(),
  creative_type: z.enum(['image', 'video']).optional(),
  // URL original (efímera) del CDN de Meta, antes de re-hospedar.
  original_creative_url: z.string().url().optional().or(z.literal('')),
});

export type IngestAd = z.infer<typeof ingestAdSchema>;

/** El cuerpo del POST /api/ads/ingest: { ads: [...] } o directamente un array. */
export const ingestPayloadSchema = z.union([
  z.object({ ads: z.array(ingestAdSchema).min(1, 'La lista de anuncios está vacía') }),
  z.array(ingestAdSchema).min(1, 'La lista de anuncios está vacía'),
]);

/** Normaliza el payload a un array de anuncios. */
export function normalizeIngestPayload(input: unknown): IngestAd[] {
  const parsed = ingestPayloadSchema.parse(input);
  return Array.isArray(parsed) ? parsed : parsed.ads;
}
