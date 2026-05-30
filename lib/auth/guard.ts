import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser, SessionUser } from '@/lib/auth/session';

/** Exige sesión en un Server Component; redirige a /login si no hay. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** Exige rol ADMIN; lanza 403 lógico si no. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/');
  return user;
}
