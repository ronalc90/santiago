import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getCurrentUser } from '@/lib/auth/session';
import { enqueueAdIngestJob, AdIngestJobData } from '@/lib/queue';
import { isAdLibraryUrl } from '@/lib/ad-library';

/** Compara tokens en tiempo constante. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

const bodySchema = z.object({
  country: z.string().min(2).max(4).optional(),
  /** Lista de keywords/nichos a buscar (cada una encola un job). Acotada. */
  keywords: z.array(z.string().min(1).max(120)).max(20).optional(),
  /** URL de página de competidor (alternativa a keywords). Solo Ad Library. */
  pageUrl: z.string().url().refine(isAdLibraryUrl, 'pageUrl debe apuntar a facebook.com/ads/library').optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

/**
 * Dispara la ingesta de anuncios REALES encolando trabajos para el worker.
 * Autenticación: sesión de usuario O header `x-ingest-token` (para cron/externos).
 * Cuerpo (opcional): { country, keywords[], pageUrl, limit }. Si no se envía,
 * usa AD_SOURCE_COUNTRY / AD_SOURCE_KEYWORDS / AD_SOURCE_LIMIT del entorno.
 */
export async function POST(req: Request) {
  try {
    const env = getEnv();

    const token = req.headers.get('x-ingest-token') ?? '';
    const hasToken = !!token && safeEqual(token, env.INGEST_API_TOKEN);
    // El token de cron es bypass de confianza; por sesión exigimos rol ADMIN
    // porque la operación gasta créditos de Apify (pay-per-result).
    if (!hasToken) {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
      if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }

    let parsedBody: z.infer<typeof bodySchema> = {};
    if (req.headers.get('content-type')?.includes('application/json')) {
      const json = await req.json().catch(() => ({}));
      const parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Cuerpo inválido', issues: parsed.error.issues }, { status: 422 });
      }
      parsedBody = parsed.data;
    }

    const country = (parsedBody.country ?? env.AD_SOURCE_COUNTRY).toUpperCase();
    const limit = parsedBody.limit ?? env.AD_SOURCE_LIMIT;

    // Construye los trabajos: por página, o una por keyword.
    const jobs: AdIngestJobData[] = [];
    if (parsedBody.pageUrl) {
      jobs.push({ country, pageUrl: parsedBody.pageUrl, limit });
    } else {
      const rawKeywords =
        parsedBody.keywords ??
        env.AD_SOURCE_KEYWORDS.split(',').map((k) => k.trim()).filter(Boolean);
      const keywords = Array.from(new Set(rawKeywords)); // dedup para no re-encolar
      if (keywords.length === 0) {
        return NextResponse.json(
          { error: 'No hay keywords. Envía { keywords: [...] } o define AD_SOURCE_KEYWORDS.' },
          { status: 400 },
        );
      }
      for (const query of keywords) jobs.push({ country, query, limit });
    }

    const jobIds = await Promise.all(jobs.map((j) => enqueueAdIngestJob(j)));
    return NextResponse.json({ enqueued: jobs.length, jobIds, country, limit }, { status: 202 });
  } catch (err) {
    console.error('[ads/sync]', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
