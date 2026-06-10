import { z } from 'zod';

/**
 * Validación centralizada de variables de entorno (capa de configuración).
 * Falla rápido y con mensajes claros si falta algo crítico.
 * Todos los secretos viven aquí; ningún módulo lee process.env directamente.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET debe tener al menos 16 caracteres'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // --- Credenciales del admin que crea el seed ---
  // Si ADMIN_PASSWORD queda vacía, el seed genera una aleatoria fuerte.
  ADMIN_EMAIL: z.string().default('socio1@winspy.local'),
  ADMIN_PASSWORD: z.string().optional().default(''),

  // --- Imágenes (Gemini) ---
  IMAGE_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-2.5-flash-image-preview'),
  GEMINI_TEXT_MODEL: z.string().default('gemini-flash-latest'),

  // --- Textos (OpenAI / Gemini) ---
  TEXT_PROVIDER: z.enum(['mock', 'openai', 'gemini']).default('mock'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_TEXT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  STORAGE_PUBLIC_BASE_URL: z.string().default('http://localhost:3000/api/files'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('auto'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),

  INGEST_API_TOKEN: z.string().min(8, 'INGEST_API_TOKEN debe tener al menos 8 caracteres'),

  // --- Fuente de anuncios reales (Meta Ad Library vía scraper gestionado) ---
  // "mock" devuelve fixtures (no gasta). "apify" usa un actor real de Apify.
  AD_SOURCE_PROVIDER: z.enum(['mock', 'apify']).default('mock'),
  APIFY_TOKEN: z.string().optional().default(''),
  // Actor de Apify; por defecto el más barato/usado (curious_coder).
  APIFY_ACTOR_ID: z.string().default('curious_coder~facebook-ads-library-scraper'),
  // País ISO-2 a vigilar por defecto y lista CSV de keywords/nichos.
  AD_SOURCE_COUNTRY: z.string().default('CO'),
  AD_SOURCE_KEYWORDS: z.string().default(''),
  AD_SOURCE_LIMIT: z.coerce.number().int().positive().default(100),
  // Cron (patrón BullMQ) para la ingesta automática; vacío = desactivado.
  AD_SOURCE_CRON: z.string().default(''),

  // Concurrencia de los workers BullMQ (proceso separado). La de ingesta es
  // más baja a propósito para acotar costo de Apify y carga sobre el CDN.
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  AD_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(1),

  // Tasa de cambio USD→COP para la página de Costos (configurable; cambia seguido).
  USD_COP_RATE: z.coerce.number().positive().default(4100),

  // --- Publicación en Shopify (Admin API) ---
  // Sin credenciales la feature queda DESACTIVADA (la ruta responde 409); el
  // build/boot NO se rompe. Dominio SIN esquema/puerto/path: "mitienda.myshopify.com".
  SHOPIFY_STORE_DOMAIN: z
    .union([
      z.string().regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/, 'SHOPIFY_STORE_DOMAIN debe ser <tienda>.myshopify.com'),
      z.literal(''),
    ])
    .default(''),
  // Admin API access token de una Custom App (formato shpat_...; scope write_products).
  SHOPIFY_ADMIN_TOKEN: z.string().optional().default(''),
  // Versión trimestral YYYY-MM. En env para actualizar sin redeploy de código.
  SHOPIFY_API_VERSION: z.string().regex(/^\d{4}-\d{2}$/).default('2025-10'),
  // Estado con el que se crea el producto: borrador (recomendado) o activo.
  SHOPIFY_PUBLISH_STATUS: z.enum(['draft', 'active']).default('draft'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Devuelve el entorno validado (memoizado). Lanza si la configuración es inválida.
 * Exige las API keys correspondientes según el proveedor seleccionado.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  const e = parsed.data;
  if (e.IMAGE_PROVIDER === 'gemini' && !e.GEMINI_API_KEY) {
    throw new Error('IMAGE_PROVIDER="gemini" requiere GEMINI_API_KEY.');
  }
  if (e.TEXT_PROVIDER === 'openai' && !e.OPENAI_API_KEY) {
    throw new Error('TEXT_PROVIDER="openai" requiere OPENAI_API_KEY.');
  }
  if (e.TEXT_PROVIDER === 'gemini' && !e.GEMINI_API_KEY) {
    throw new Error('TEXT_PROVIDER="gemini" requiere GEMINI_API_KEY.');
  }
  if (e.AD_SOURCE_PROVIDER === 'apify' && !e.APIFY_TOKEN) {
    throw new Error('AD_SOURCE_PROVIDER="apify" requiere APIFY_TOKEN.');
  }
  // Shopify: exigir la pareja dominio+token (o ninguno). Evita un estado a medias
  // que fallaría en runtime. Como ambos default '', sin Shopify no salta.
  if (Boolean(e.SHOPIFY_STORE_DOMAIN) !== Boolean(e.SHOPIFY_ADMIN_TOKEN)) {
    throw new Error('Shopify requiere SHOPIFY_STORE_DOMAIN y SHOPIFY_ADMIN_TOKEN juntos (o ninguno).');
  }

  // --- Guardas de PRODUCCIÓN ------------------------------------------------
  // Avisos (no bloqueantes) cuando la configuración delataría datos demo o un
  // almacenamiento no compartido entre Vercel y Railway.
  if (e.NODE_ENV === 'production') {
    if (e.AD_SOURCE_PROVIDER === 'mock') {
      console.warn(
        '⚠️  AD_SOURCE_PROVIDER="mock" en PRODUCCIÓN: se servirán anuncios DEMO (fixtures). ' +
          'Configura AD_SOURCE_PROVIDER="apify" + APIFY_TOKEN en el worker (Railway) para datos reales.',
      );
    }
    if (e.STORAGE_DRIVER === 'local') {
      console.warn(
        '⚠️  STORAGE_DRIVER="local" en PRODUCCIÓN: los creativos NO se compartirán entre Vercel y Railway. ' +
          'Usa STORAGE_DRIVER="s3" para un almacenamiento común.',
      );
    }
    if (e.TEXT_PROVIDER === 'mock') {
      console.warn(
        '⚠️  TEXT_PROVIDER="mock" en PRODUCCIÓN: las sugerencias de producto y el copy de landing ' +
          'devolverían texto de relleno. Configura TEXT_PROVIDER="openai" (+ OPENAI_API_KEY) o "gemini".',
      );
    }
  }

  // S3 exige bucket y URL pública en cualquier entorno; sin ellos el driver no
  // puede subir ni servir creativos.
  if (e.STORAGE_DRIVER === 's3') {
    if (!e.S3_BUCKET) {
      throw new Error('STORAGE_DRIVER="s3" requiere S3_BUCKET.');
    }
    if (!e.S3_PUBLIC_BASE_URL) {
      throw new Error('STORAGE_DRIVER="s3" requiere S3_PUBLIC_BASE_URL.');
    }
  }

  cached = e;
  return cached;
}
