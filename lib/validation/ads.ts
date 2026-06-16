import { z } from 'zod';

/**
 * Booleano tolerante para señales que la skill puede mandar como string. A
 * diferencia de z.coerce.boolean() (que vuelve `true` CUALQUIER string no vacío,
 * incluido "false"), aquí solo los valores true-ish explícitos dan true; ausente
 * o vacío queda `undefined` para que apliquen los defaults de la ingesta.
 */
const looseBoolean = z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === '') return undefined;
    return s === 'true' || s === '1' || s === 'yes' || s === 'si' || s === 'sí';
  }
  return undefined;
}, z.boolean().optional());

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
  sells_in_colombia: looseBoolean,
  has_unused_foreign_creative: looseBoolean,
  // Metadatos reales opcionales (Ad Library). Se conservan en `raw` para
  // auditoría; no requieren columnas en la base de datos.
  cta_text: z.string().optional(),
  link_url: z.string().url().optional().or(z.literal('')),
  publisher_platforms: z.array(z.string()).optional(),
  is_active: looseBoolean,
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

/**
 * Sanea el copy de un anuncio: elimina placeholders del anunciante tipo
 * "{{product.brand}}" (cualquier {{...}}), colapsa espacios y recorta. Devuelve
 * null si tras la limpieza no queda texto útil, para no guardar copys vacíos.
 */
export function sanitizeCopy(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}
