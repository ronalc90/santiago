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
