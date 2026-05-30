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

  IMAGE_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_IMAGE_MODEL: z.string().default('gemini-2.5-flash-image-preview'),
  GEMINI_TEXT_MODEL: z.string().default('gemini-2.0-flash'),

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
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Devuelve el entorno validado (memoizado). Lanza si la configuración es inválida.
 * Si el proveedor es "gemini" exige GEMINI_API_KEY.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  if (parsed.data.IMAGE_PROVIDER === 'gemini' && !parsed.data.GEMINI_API_KEY) {
    throw new Error('IMAGE_PROVIDER="gemini" requiere GEMINI_API_KEY.');
  }
  cached = parsed.data;
  return cached;
}
