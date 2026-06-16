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
import {
  LANDING_QUEUE,
  LandingJobData,
  AD_INGEST_QUEUE,
  AdIngestJobData,
  getAdIngestQueue,
  COST_SYNC_QUEUE,
  CostSyncJobData,
  getCostSyncQueue,
  MELI_SATURATION_QUEUE,
  MeliSaturationJobData,
  getMeliSaturationQueue,
} from '../lib/queue';
import { getRedis } from '../lib/queue/connection';
import { processLanding, failLanding } from '../lib/services/landing';
import { runAdIngest } from '../lib/services/ad-ingest';
import { syncShopifyCosts } from '../lib/services/cost-sync';
import { syncMeliSaturation } from '../lib/services/meli';
import { isShopifyConfigured } from '../lib/shopify/client';
import { isMeliConfigured } from '../lib/integrations/mercadolibre';
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

// Worker de sincronización de costos desde Shopify (margen real).
const costSyncWorker = new Worker<CostSyncJobData>(
  COST_SYNC_QUEUE,
  async () => {
    console.log('▶️  Sincronizando costos desde Shopify…');
    const r = await syncShopifyCosts();
    if (!r.configured) console.log('ℹ️  Costos: Shopify no está configurado; nada que sincronizar.');
    else if (r.missingScope) console.warn('⚠️  Costos: falta el scope read_inventory en la app de Shopify.');
    else console.log(`✅  Costos: ${r.updated} actualizados, ${r.matched} emparejados, ${r.withoutCost} sin costo (de ${r.total}).`);
    return r;
  },
  { connection: getRedis(), concurrency: 1 },
);

// Worker de medición de saturación en MercadoLibre (competencia CO).
const meliSaturationWorker = new Worker<MeliSaturationJobData>(
  MELI_SATURATION_QUEUE,
  async () => {
    console.log('▶️  Midiendo saturación en MercadoLibre…');
    const r = await syncMeliSaturation();
    if (!r.configured) console.log('ℹ️  Saturación: MercadoLibre no está configurado; nada que medir.');
    else if (!r.connected) console.warn('⚠️  Saturación: MercadoLibre no está conectado (OAuth); conéctalo en Ajustes.');
    else console.log(`✅  Saturación: ${r.updated} cambiaron, ${r.measured} medidos, ${r.withoutData} sin dato (de ${r.total}).`);
    return r;
  },
  { connection: getRedis(), concurrency: 1 },
);

for (const w of [landingWorker, adWorker, costSyncWorker, meliSaturationWorker]) {
  w.on('failed', (job, err) => console.error(`❌  Job ${job?.id} falló:`, err.message));
  w.on('error', (err) => console.error('Worker error:', err));
}

// Resiliencia: si una landing falla (incluido un crash que impida a processLanding
// terminar su propio catch), garantizamos aquí que el proyecto y su Job no queden
// atascados en QUEUED/PROCESSING. failLanding es idempotente.
landingWorker.on('failed', (job, err) => {
  const projectId = job?.data?.projectId;
  if (!projectId) return;
  void failLanding(projectId, err instanceof Error ? err.message : 'Error al generar la landing').catch((e) =>
    console.error(`No se pudo marcar la landing ${projectId} como fallida:`, e instanceof Error ? e.message : e),
  );
});

// Cron opcional de ingesta. El .catch evita que un fallo aquí (p. ej. patrón
// inválido o Redis aún no listo) tumbe el worker en crash-loop.
void scheduleAdIngestCron().catch((e) =>
  console.error('⏰  No se pudo programar la ingesta:', e instanceof Error ? e.message : e),
);

// Cron diario de refresco de costos (solo si Shopify está configurado y hay patrón).
void scheduleCostSyncCron().catch((e) =>
  console.error('⏰  No se pudo programar la sync de costos:', e instanceof Error ? e.message : e),
);

// Cron diario de medición de saturación (solo si MercadoLibre está configurado).
void scheduleMeliSaturationCron().catch((e) =>
  console.error('⏰  No se pudo programar la saturación de ML:', e instanceof Error ? e.message : e),
);

/** Programa (o elimina) el refresco diario de costos desde Shopify según COST_SYNC_CRON. */
async function scheduleCostSyncCron(): Promise<void> {
  const queue = getCostSyncQueue();
  const id = 'cost-sync:daily';
  const enabled = Boolean(env.COST_SYNC_CRON) && isShopifyConfigured();
  if (!enabled) {
    await queue.removeJobScheduler(id).catch(() => {});
    return;
  }
  await queue.upsertJobScheduler(
    id,
    { pattern: env.COST_SYNC_CRON },
    { name: 'sync', opts: { removeOnComplete: 50, removeOnFail: 100, attempts: 1 } },
  );
  console.log(`⏰  Sync de costos programada (${env.COST_SYNC_CRON}).`);
}

/** Programa (o elimina) la medición diaria de saturación según MELI_SATURATION_CRON. */
async function scheduleMeliSaturationCron(): Promise<void> {
  const queue = getMeliSaturationQueue();
  const id = 'meli-saturation:daily';
  const enabled = Boolean(env.MELI_SATURATION_CRON) && isMeliConfigured();
  if (!enabled) {
    await queue.removeJobScheduler(id).catch(() => {});
    return;
  }
  await queue.upsertJobScheduler(
    id,
    { pattern: env.MELI_SATURATION_CRON },
    { name: 'measure', opts: { removeOnComplete: 50, removeOnFail: 100, attempts: 1 } },
  );
  console.log(`⏰  Saturación de ML programada (${env.MELI_SATURATION_CRON}).`);
}

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
  await Promise.all([landingWorker.close(), adWorker.close(), costSyncWorker.close(), meliSaturationWorker.close()]);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
