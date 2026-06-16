import { Queue } from 'bullmq';
import { getRedis } from '@/lib/queue/connection';

export const LANDING_QUEUE = 'landing-generation';

export interface LandingJobData {
  projectId: string;
  /** Si se define, regenera solo ese slot (1..9); si no, genera las 9. */
  onlySlot?: number;
}

let queue: Queue<LandingJobData> | null = null;

/** Cola de generación de landings (productor). El worker es un proceso aparte. */
export function getLandingQueue(): Queue<LandingJobData> {
  if (queue) return queue;
  queue = new Queue<LandingJobData>(LANDING_QUEUE, { connection: getRedis() });
  return queue;
}

/** Encola un trabajo de generación. */
export async function enqueueLandingJob(data: LandingJobData): Promise<string> {
  const job = await getLandingQueue().add('generate', data, {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 1,
  });
  return job.id ?? '';
}

// ---------------------------------------------------------------------------
// Cola de ingesta de anuncios reales (Meta Ad Library vía fuente configurada).
// ---------------------------------------------------------------------------

export const AD_INGEST_QUEUE = 'ad-ingestion';

export interface AdIngestJobData {
  /** País ISO-2 a buscar (CO, MX…). */
  country: string;
  /** Texto de búsqueda (nicho/keyword). */
  query?: string;
  /** URL de página de competidor (alternativa a query). */
  pageUrl?: string;
  /** Máximo de anuncios a traer. */
  limit: number;
}

let adQueue: Queue<AdIngestJobData> | null = null;

/** Cola de ingesta de anuncios (productor). El worker la consume aparte. */
export function getAdIngestQueue(): Queue<AdIngestJobData> {
  if (adQueue) return adQueue;
  adQueue = new Queue<AdIngestJobData>(AD_INGEST_QUEUE, { connection: getRedis() });
  return adQueue;
}

/** Encola un trabajo de ingesta de anuncios. */
export async function enqueueAdIngestJob(data: AdIngestJobData): Promise<string> {
  const job = await getAdIngestQueue().add('ingest', data, {
    removeOnComplete: 100,
    removeOnFail: 200,
    // attempts:1 — un reintento re-ejecutaría (y re-pagaría) el scrape de Apify.
    // runActor() y download() ya tienen sus propios reintentos internos.
    attempts: 1,
  });
  return job.id ?? '';
}

// ---------------------------------------------------------------------------
// Cola de sincronización de costos desde Shopify (worker, no bloquea la UI).
// ---------------------------------------------------------------------------

export const COST_SYNC_QUEUE = 'cost-sync';

/** El job no necesita payload: sincroniza todos los costos. */
export type CostSyncJobData = Record<string, never>;

let costSyncQueue: Queue<CostSyncJobData> | null = null;

export function getCostSyncQueue(): Queue<CostSyncJobData> {
  if (costSyncQueue) return costSyncQueue;
  costSyncQueue = new Queue<CostSyncJobData>(COST_SYNC_QUEUE, { connection: getRedis() });
  return costSyncQueue;
}

/** Encola una sincronización de costos (manual desde la UI). */
export async function enqueueCostSyncJob(): Promise<string> {
  const job = await getCostSyncQueue().add('sync', {}, { removeOnComplete: 50, removeOnFail: 100, attempts: 1 });
  return job.id ?? '';
}

// ---------------------------------------------------------------------------
// Cola de medición de saturación en MercadoLibre (worker, no bloquea la UI).
// ---------------------------------------------------------------------------

export const MELI_SATURATION_QUEUE = 'meli-saturation';

/** El job no necesita payload: mide la saturación de todos los productos. */
export type MeliSaturationJobData = Record<string, never>;

let meliSaturationQueue: Queue<MeliSaturationJobData> | null = null;

export function getMeliSaturationQueue(): Queue<MeliSaturationJobData> {
  if (meliSaturationQueue) return meliSaturationQueue;
  meliSaturationQueue = new Queue<MeliSaturationJobData>(MELI_SATURATION_QUEUE, { connection: getRedis() });
  return meliSaturationQueue;
}

/** Encola una medición de saturación (manual desde la UI). */
export async function enqueueMeliSaturationJob(): Promise<string> {
  const job = await getMeliSaturationQueue().add('measure', {}, { removeOnComplete: 50, removeOnFail: 100, attempts: 1 });
  return job.id ?? '';
}
