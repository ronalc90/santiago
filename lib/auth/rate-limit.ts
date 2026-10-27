import IORedis, { Redis } from 'ioredis';
import { getEnv } from '@/lib/config/env';

/**
 * Límite de intentos de login por IP (contador en Redis, apto para serverless).
 *
 * Usa una conexión ioredis DEDICADA (no la de BullMQ, cuyo
 * maxRetriesPerRequest:null deja colgada la función de Vercel reintentando) con
 * timeouts cortos y un techo absoluto por operación.
 *
 * Qué pasa si Redis falla o no responde a tiempo (decisión documentada):
 * - Redis REMOTO (producción, Upstash `rediss://…`): FALLA CERRADO. El login
 *   responde 503 sin evaluar credenciales. Un límite que se apaga cuando Redis
 *   cae (o con solo saturarlo) deja la puerta abierta a la fuerza bruta.
 * - Redis en LOOPBACK (desarrollo: el default `redis://localhost:6379` o el de
 *   docker compose): FALLA ABIERTO, para poder entrar en local sin levantar Redis.
 * - `LOGIN_RATE_LIMIT_FAIL_MODE=open|closed` fuerza la política. `open` sirve de
 *   válvula de escape temporal si Upstash cae en producción y hay que entrar.
 */

export const RL_MAX_ATTEMPTS = 10; // intentos permitidos por ventana
export const RL_WINDOW_SECONDS = 10 * 60; // ventana de 10 minutos
export const RL_TIMEOUT_MS = 2500; // techo absoluto (incluye conectar en frío)

export type FailMode = 'open' | 'closed';
export type RateLimitResult = 'allowed' | 'limited' | 'unavailable';

/** Política efectiva ante un fallo de Redis (ver comentario del módulo). */
export function resolveFailMode(redisUrl: string, override: 'auto' | FailMode): FailMode {
  if (override !== 'auto') return override;
  return isLoopbackUrl(redisUrl) ? 'open' : 'closed';
}

function isLoopbackUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();
  } catch {
    return false;
  }
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host);
}

let connection: Redis | null = null;

/**
 * Conexión ioredis del rate-limit. Opciones para no colgar la función serverless:
 * - maxRetriesPerRequest: 1 → no reintenta indefinidamente.
 * - connectTimeout / commandTimeout → fallan rápido.
 * - lazyConnect → no conecta hasta el primer comando.
 * - enableOfflineQueue: solo en modo cerrado. Ahí el primer comando tras un
 *   arranque en frío (o una reconexión) espera a que la conexión esté lista,
 *   acotado por commandTimeout; sin cola, ioredis lo rechazaría al instante
 *   ("Stream isn't writeable") y ese login recibiría un 503 espurio. En modo
 *   abierto (local) se mantiene sin cola: si no hay Redis, falla al momento y el
 *   login no se demora.
 */
function getConnection(mode: FailMode): Redis {
  if (connection) return connection;
  connection = new IORedis(getEnv().REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: mode === 'closed',
    connectTimeout: 2000,
    commandTimeout: 1500,
    lazyConnect: true,
  });
  // Evita que un error de conexión emergente tumbe el proceso.
  connection.on('error', () => {});
  return connection;
}

/** INCR atómico; fija la expiración de la ventana en el primer intento. */
async function countAttempt(redis: Redis, key: string): Promise<number> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RL_WINDOW_SECONDS);
  return count;
}

/**
 * Cuenta el intento de login de `ip` y dice si puede continuar:
 * - 'allowed'     → dentro del límite (o Redis caído con política abierta).
 * - 'limited'     → superó RL_MAX_ATTEMPTS en la ventana → 429.
 * - 'unavailable' → Redis caído o lento con política cerrada → 503.
 */
export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  const env = getEnv();
  const mode = resolveFailMode(env.REDIS_URL, env.LOGIN_RATE_LIMIT_FAIL_MODE);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const count = await Promise.race([
      countAttempt(getConnection(mode), `rl:login:${ip}`),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`sin respuesta en ${RL_TIMEOUT_MS} ms`)), RL_TIMEOUT_MS);
      }),
    ]);
    return count > RL_MAX_ATTEMPTS ? 'limited' : 'allowed';
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (mode === 'closed') {
      console.error(`[auth/rate-limit] Redis no disponible; login rechazado (falla cerrado): ${reason}`);
      return 'unavailable';
    }
    console.warn(`[auth/rate-limit] Redis no disponible; se permite el intento (falla abierto): ${reason}`);
    return 'allowed';
  } finally {
    clearTimeout(timer);
  }
}
