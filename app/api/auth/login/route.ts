import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

// Nota: el rate limiting por IP debe hacerse con un cliente Redis compatible con
// serverless (Upstash REST / Vercel KV), NO con ioredis (conexión persistente),
// que en las funciones de Vercel se cuelga y tumba el login. Pendiente reintroducir.

export async function POST(req: Request) {
  try {
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
