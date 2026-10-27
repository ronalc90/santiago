import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '@/lib/auth/password';
import { checkLoginRateLimit } from '@/lib/auth/rate-limit';
import { createSession } from '@/lib/auth/session';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

/** Extrae la IP del cliente desde x-forwarded-for (primer valor de la cadena). */
function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(req: Request) {
  try {
    // Límite de intentos por IP. Si Redis no responde, en producción falla
    // cerrado (503) y en local falla abierto: ver lib/auth/rate-limit.ts.
    const limit = await checkLoginRateLimit(clientIp(req));
    if (limit === 'limited') {
      return NextResponse.json(
        { error: 'Demasiados intentos. Inténtalo de nuevo en unos minutos.' },
        { status: 429 },
      );
    }
    if (limit === 'unavailable') {
      return NextResponse.json(
        { error: 'No se puede iniciar sesión en este momento. Inténtalo de nuevo en unos minutos.' },
        { status: 503, headers: { 'Retry-After': '60' } },
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Siempre se ejecuta un bcrypt.compare: si el email no existe, contra un hash
    // fijo del mismo coste. Así el tiempo de respuesta no delata qué emails están
    // registrados (antes, sin usuario se respondía sin hacer el trabajo de bcrypt).
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    // Mensaje genérico para no filtrar si el email existe
    if (!user || !passwordOk) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[auth/login]', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
