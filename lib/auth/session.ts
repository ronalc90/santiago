import 'server-only';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config/env';
import { asTheme, Theme } from '@/lib/theme';

export const SESSION_COOKIE = 'winspy_session';

/** Genera un token de sesión opaco y aleatorio. */
function newToken(): string {
  return randomBytes(32).toString('hex');
}

/** Crea una sesión en BD y setea la cookie httpOnly. */
export async function createSession(userId: string): Promise<void> {
  const env = getEnv();
  const token = newToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

/** Destruye la sesión actual (BD + cookie). */
export async function destroySession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookies().delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'MEMBER';
  theme: Theme;
};

/**
 * Devuelve el usuario autenticado o null. Valida el token contra la BD y
 * comprueba expiración (limpia sesiones vencidas).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, role: u.role, theme: asTheme(u.theme) };
}
