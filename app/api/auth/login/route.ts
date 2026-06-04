import { NextResponse } from 'next/server';
import IORedis, { Redis } from 'ioredis';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config/env';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

// --- Rate limiting por IP (serverless-safe) --------------------------------
// El intento anterior usaba la conexión de BullMQ (maxRetriesPerRequest:null),
// que en funciones de Vercel se queda colgada reintentando y tumba el login.
// Aquí usamos una conexión ioredis DEDICADA con opciones que fallan rápido y
// NUNCA bloquean: si Redis no responde a tiempo, degradamos a permitir el login.
const RL_MAX_ATTEMPTS = 10; // intentos permitidos por ventana
const RL_WINDOW_SECONDS = 10 * 60; // ventana de 10 minutos
const RL_TIMEOUT_MS = 1200; // techo absoluto para la operación de rate-limit

let rlConnection: Redis | null = null;

/**
 * Conexión ioredis dedicada al rate-limit, separada de la de BullMQ.
 * Opciones pensadas para no colgar la función serverless:
 * - maxRetriesPerRequest: 1 → no reintenta indefinidamente.
 * - enableOfflineQueue: false → no encola comandos si no hay conexión.
 * - connectTimeout / commandTimeout → fallan rápido.
 * - lazyConnect → no conecta hasta el primer comando.
 */
function getRateLimitRedis(): Redis {
  if (rlConnection) return rlConnection;
  const env = getEnv();
  rlConnection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2000,
    commandTimeout: 1000,
    lazyConnect: true,
  });
  // Evita que un error de conexión emergente tumbe el proceso.
  rlConnection.on('error', () => {});
  return rlConnection;
}

/** Extrae la IP del cliente desde x-forwarded-for (primer valor de la cadena). */
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Indica si la IP superó el límite de intentos. Cuenta el intento actual de
 * forma atómica (INCR + EXPIRE en la primera vez). Si Redis falla o tarda más
 * de RL_TIMEOUT_MS, DEGRADA devolviendo false (permitir el login).
 */
async function isRateLimited(ip: string): Promise<boolean> {
  const key = `rl:login:${ip}`;
  try {
    const check = (async (): Promise<boolean> => {
      const redis = getRateLimitRedis();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, RL_WINDOW_SECONDS);
      }
      return count > RL_MAX_ATTEMPTS;
    })();

    const timeout = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), RL_TIMEOUT_MS);
    });

    return await Promise.race([check, timeout]);
  } catch (err) {
    // Cualquier fallo de Redis no debe impedir el login: degradamos a permitir.
    console.warn('[auth/login] rate-limit degradado (Redis no disponible)', err);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Mensaje genérico para no filtrar si el email existe
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[auth/login]', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
