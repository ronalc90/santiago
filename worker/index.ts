/**
 * Worker de generación de landings (proceso separado).
 *
 * En local corre junto a la app:   npm run worker
 * En producción (Vercel) se despliega aparte (Railway/Render) apuntando al
 * mismo Redis y Postgres. Consume la cola BullMQ y ejecuta processLanding().
 */
import 'dotenv/config';
import { setDefaultResultOrder } from 'node:dns';
// Algunos contenedores (Railway) no tienen ruta IPv6; sin esto, fetch() a CDNs
// con AAAA (p. ej. fbcdn de Meta) falla con "fetch failed". Preferimos IPv4.
setDefaultResultOrder('ipv4first');
import { Worker } from 'bullmq';
import { LANDING_QUEUE, LandingJobData, AD_INGEST_QUEUE, AdIngestJobData, getAdIngestQueue } from '../lib/queue';
import { getRedis } from '../lib/queue/connection';
import { processLanding } from '../lib/services/landing';
import { runAdIngest } from '../lib/services/ad-ingest';
import { getEnv } from '../lib/config/env';

const env = getEnv();

console.log(`🛠️  Worker iniciando (landings=${env.WORKER_CONCURRENCY}, ingesta=${env.AD_WORKER_CONCURRENCY})...`);

const landingWorker = new Worker<LandingJobData>(
  LANDING_QUEUE,
  async (job) => {
    const { projectId, onlySlot } = job.data;
    console.log(`▶️  Procesando landing ${projectId}${onlySlot ? ` (slot ${onlySlot})` : ''}`);
    await processLanding(projectId, onlySlot);
    console.log(`✅  Landing ${projectId} completada`);
  },
  { connection: getRedis(), concurrency: env.WORKER_CONCURRENCY },
);

// Worker de ingesta de anuncios reales (Meta Ad Library).
const adWorker = new Worker<AdIngestJobData>(
  AD_INGEST_QUEUE,
  async (job) => {
    const { country, query, pageUrl, limit } = job.data;
    console.log(`▶️  Ingiriendo anuncios (${country}${query ? ` · "${query}"` : ''}${pageUrl ? ` · página` : ''})`);
    const summary = await runAdIngest({ country, query, pageUrl, limit });
    console.log(
      `✅  Ingesta: ${summary.fetched} traídos, ${summary.withCreative} con creativo nuevo, ` +
        `${summary.reused} reutilizados, ${summary.creativeErrors} sin creativo · ` +
        `${summary.ingest.created} nuevos / ${summary.ingest.updated} actualizados`,
    );
    return summary;
  },
  { connection: getRedis(), concurrency: env.AD_WORKER_CONCURRENCY },
);

for (const w of [landingWorker, adWorker]) {
  w.on('failed', (job, err) => console.error(`❌  Job ${job?.id} falló:`, err.message));
  w.on('error', (err) => console.error('Worker error:', err));
}

// Cron opcional de ingesta. El .catch evita que un fallo aquí (p. ej. patrón
// inválido o Redis aún no listo) tumbe el worker en crash-loop.
void scheduleAdIngestCron().catch((e) =>
  console.error('⏰  No se pudo programar la ingesta:', e instanceof Error ? e.message : e),
);

/**
 * Programa la ingesta por keyword usando Job Schedulers (id estable por
 * keyword+país, sin el patrón en el id) y RECONCILIA: elimina los schedulers
 * que ya no correspondan a la config actual (keyword quitada o cron desactivado),
 * evitando huérfanos que seguirían gastando créditos de Apify.
 */
async function scheduleAdIngestCron(): Promise<void> {
  const queue = getAdIngestQueue();
  const prefix = `ad-ingest:${env.AD_SOURCE_COUNTRY}:`;
  const schedulerId = (q: string) => `${prefix}${q}`;

  const keywords = env.AD_SOURCE_CRON
    ? env.AD_SOURCE_KEYWORDS.split(',').map((k) => k.trim()).filter(Boolean)
    : [];
  const desired = new Set(keywords.map(schedulerId));

  // Reconciliar: borra schedulers obsoletos de este país que ya no se desean.
  const existing = await queue.getJobSchedulers(0, -1);
  for (const s of existing) {
    if (s.id && s.id.startsWith(prefix) && !desired.has(s.id)) {
      await queue.removeJobScheduler(s.id);
      console.log(`🧹  Scheduler de ingesta obsoleto eliminado: ${s.id}`);
    }
  }

  if (keywords.length === 0) {
    if (env.AD_SOURCE_CRON) {
      console.log('ℹ️  AD_SOURCE_CRON definido pero sin AD_SOURCE_KEYWORDS; no se programa ingesta.');
    }
    return;
  }

  // Upsert: crea o reemplaza in-place el scheduler de cada keyword con el patrón
  // actual (cambiar AD_SOURCE_CRON actualiza el mismo id, no crea uno nuevo).
  for (const query of keywords) {
    await queue.upsertJobScheduler(
      schedulerId(query),
      { pattern: env.AD_SOURCE_CRON },
      {
        name: 'ingest',
        data: { country: env.AD_SOURCE_COUNTRY, query, limit: env.AD_SOURCE_LIMIT },
        opts: { removeOnComplete: 100, removeOnFail: 200, attempts: 1 },
      },
    );
  }
  console.log(`⏰  Ingesta programada (${env.AD_SOURCE_CRON}) para ${keywords.length} keyword(s) en ${env.AD_SOURCE_COUNTRY}.`);
}

// Cierre ordenado
async function shutdown(): Promise<void> {
  await Promise.all([landingWorker.close(), adWorker.close()]);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
