/**
 * Worker de generación de landings (proceso separado).
 *
 * En local corre junto a la app:   npm run worker
 * En producción (Vercel) se despliega aparte (Railway/Render) apuntando al
 * mismo Redis y Postgres. Consume la cola BullMQ y ejecuta processLanding().
 */
import 'dotenv/config';
import { Worker } from 'bullmq';
import { LANDING_QUEUE, LandingJobData } from '../lib/queue';
import { getRedis } from '../lib/queue/connection';
import { processLanding } from '../lib/services/landing';

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);

console.log(`🛠️  Worker de landings iniciando (concurrencia=${CONCURRENCY})...`);

const worker = new Worker<LandingJobData>(
  LANDING_QUEUE,
  async (job) => {
    const { projectId, onlySlot } = job.data;
    console.log(`▶️  Procesando landing ${projectId}${onlySlot ? ` (slot ${onlySlot})` : ''}`);
    await processLanding(projectId, onlySlot);
    console.log(`✅  Landing ${projectId} completada`);
  },
  { connection: getRedis(), concurrency: CONCURRENCY },
);

worker.on('failed', (job, err) => {
  console.error(`❌  Job ${job?.id} falló:`, err.message);
});

worker.on('error', (err) => console.error('Worker error:', err));

// Cierre ordenado
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
