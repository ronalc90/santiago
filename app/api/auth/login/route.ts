import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { getRedis } from '@/lib/queue/connection';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

// Rate limiting por IP: ventana deslizante de 10 minutos, máx 10 intentos.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

/** Extrae la IP del cliente del header x-forwarded-for (primera de la lista). */
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (!fwd) return 'unknown';
  const first = fwd.split(',')[0]?.trim();
  return first || 'unknown';
}

/**
 * Ventana deslizante por IP sobre un sorted-set de Redis.
 * Devuelve true si el intento debe BLOQUEARSE (429).
 * Si Redis falla, NO bloquea (degrada a permitir) para no dejar el login caído.
 */
async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const key = `ratelimit:login:${ip}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    const pipeline = redis.multi();
    // Limpia los intentos fuera de la ventana actual.
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Registra este intento (score = timestamp; member único para no colisionar).
    pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
    // Cuenta los intentos dentro de la ventana.
    pipeline.zcard(key);
    // TTL para que la clave se libere sola si la IP deja de intentar.
    pipeline.pexpire(key, RATE_LIMIT_WINDOW_MS);

    const results = await pipeline.exec();
    // results[2] = [err, count] del zcard.
    const zcardResult = results?.[2];
    if (!zcardResult || zcardResult[0]) return false; // error en el comando → no bloquear
    const count = Number(zcardResult[1]);
    return Number.isFinite(count) && count > RATE_LIMIT_MAX_ATTEMPTS;
  } catch (err) {
    // Redis caído/indisponible: degradar a permitir, nunca tumbar el login.
    console.error('[auth/login] rate limit no disponible (se permite el intento)', err);
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
