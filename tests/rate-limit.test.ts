import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Límite de intentos de login (lib/auth/rate-limit.ts): qué pasa cuando Redis
 * falla según dónde esté. ioredis va simulado (sin Redis real).
 */

const redis = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  ctorOptions: [] as Record<string, unknown>[],
}));

vi.mock('ioredis', () => {
  class FakeRedis {
    constructor(_url: string, opts: Record<string, unknown>) {
      redis.ctorOptions.push(opts);
    }
    incr = redis.incr;
    expire = redis.expire;
    on() {
      return this;
    }
  }
  return { default: FakeRedis, Redis: FakeRedis };
});

const ENV_KEYS = ['REDIS_URL', 'LOGIN_RATE_LIMIT_FAIL_MODE'] as const;
const saved: Record<string, string | undefined> = {};

/** Carga el módulo con un entorno nuevo (getEnv y la conexión están memoizados). */
async function load(env: { REDIS_URL: string; LOGIN_RATE_LIMIT_FAIL_MODE?: string }) {
  process.env.REDIS_URL = env.REDIS_URL;
  if (env.LOGIN_RATE_LIMIT_FAIL_MODE) process.env.LOGIN_RATE_LIMIT_FAIL_MODE = env.LOGIN_RATE_LIMIT_FAIL_MODE;
  else delete process.env.LOGIN_RATE_LIMIT_FAIL_MODE;
  vi.resetModules();
  return import('@/lib/auth/rate-limit');
}

const UPSTASH = 'rediss://default:pw@eu1-x.upstash.io:6379';
const LOCAL = 'redis://localhost:6380';

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  redis.incr.mockReset();
  redis.expire.mockReset().mockResolvedValue(1);
  redis.ctorOptions.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('resolveFailMode', () => {
  it('auto: abierto con Redis en loopback, cerrado con uno remoto', async () => {
    const { resolveFailMode } = await load({ REDIS_URL: LOCAL });
    for (const url of ['redis://localhost:6379', 'redis://127.0.0.1:6380', 'redis://[::1]:6379', 'redis://app.localhost']) {
      expect(resolveFailMode(url, 'auto')).toBe('open');
    }
    for (const url of [UPSTASH, 'redis://redis.internal:6379', 'redis://10.0.0.5:6379', 'no-es-url']) {
      expect(resolveFailMode(url, 'auto')).toBe('closed');
    }
  });

  it('LOGIN_RATE_LIMIT_FAIL_MODE fuerza la política', async () => {
    const { resolveFailMode } = await load({ REDIS_URL: LOCAL });
    expect(resolveFailMode(UPSTASH, 'open')).toBe('open');
    expect(resolveFailMode(LOCAL, 'closed')).toBe('closed');
  });
});

describe('checkLoginRateLimit', () => {
  it('cuenta intentos y fija la ventana en el primero', async () => {
    const { checkLoginRateLimit, RL_WINDOW_SECONDS } = await load({ REDIS_URL: UPSTASH });
    redis.incr.mockResolvedValue(1);
    expect(await checkLoginRateLimit('1.2.3.4')).toBe('allowed');
    expect(redis.incr).toHaveBeenCalledWith('rl:login:1.2.3.4');
    expect(redis.expire).toHaveBeenCalledWith('rl:login:1.2.3.4', RL_WINDOW_SECONDS);
  });

  it('limita al superar el máximo', async () => {
    const { checkLoginRateLimit, RL_MAX_ATTEMPTS } = await load({ REDIS_URL: UPSTASH });
    redis.incr.mockResolvedValue(RL_MAX_ATTEMPTS);
    expect(await checkLoginRateLimit('1.2.3.4')).toBe('allowed');
    redis.incr.mockResolvedValue(RL_MAX_ATTEMPTS + 1);
    expect(await checkLoginRateLimit('1.2.3.4')).toBe('limited');
  });

  it('Redis remoto caído → falla CERRADO', async () => {
    const { checkLoginRateLimit } = await load({ REDIS_URL: UPSTASH });
    redis.incr.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await checkLoginRateLimit('1.2.3.4')).toBe('unavailable');
    // En modo cerrado el primer comando espera a la conexión (no un 503 espurio en frío).
    expect(redis.ctorOptions[0]).toMatchObject({ enableOfflineQueue: true, lazyConnect: true, maxRetriesPerRequest: 1 });
  });

  it('Redis remoto que no responde → falla CERRADO al vencer el techo', async () => {
    const { checkLoginRateLimit, RL_TIMEOUT_MS } = await load({ REDIS_URL: UPSTASH });
    vi.useFakeTimers();
    redis.incr.mockReturnValue(new Promise(() => {}));
    const result = checkLoginRateLimit('1.2.3.4');
    await vi.advanceTimersByTimeAsync(RL_TIMEOUT_MS);
    expect(await result).toBe('unavailable');
  });

  it('Redis local sin levantar → falla ABIERTO (el login en local sigue funcionando)', async () => {
    const { checkLoginRateLimit } = await load({ REDIS_URL: LOCAL });
    redis.incr.mockRejectedValue(new Error("Stream isn't writeable and enableOfflineQueue options is false"));
    expect(await checkLoginRateLimit('1.2.3.4')).toBe('allowed');
    expect(redis.ctorOptions[0]).toMatchObject({ enableOfflineQueue: false });
  });

  it('LOGIN_RATE_LIMIT_FAIL_MODE=open deja pasar aunque Redis sea remoto', async () => {
    const { checkLoginRateLimit } = await load({ REDIS_URL: UPSTASH, LOGIN_RATE_LIMIT_FAIL_MODE: 'open' });
    redis.incr.mockRejectedValue(new Error('ETIMEDOUT'));
    expect(await checkLoginRateLimit('1.2.3.4')).toBe('allowed');
  });
});
