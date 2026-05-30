import { NextResponse } from 'next/server';
import { getCurrentUser, SessionUser } from '@/lib/auth/session';

/**
 * Helper para route handlers: devuelve el usuario o una respuesta 401.
 * Uso:
 *   const auth = await requireApiUser();
 *   if (auth instanceof NextResponse) return auth;
 *   // auth es SessionUser
 */
export async function requireApiUser(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  return user;
}
