import IORedis, { Redis } from 'ioredis';
import { getEnv } from '@/lib/config/env';

let connection: Redis | null = null;

/** Conexión compartida a Redis para BullMQ (maxRetriesPerRequest=null es requerido por BullMQ). */
export function getRedis(): Redis {
  if (connection) return connection;
  const env = getEnv();
  connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}
