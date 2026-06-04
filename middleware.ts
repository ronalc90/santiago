import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'winspy_session';

/**
 * Middleware de protección de rutas (edge). Solo comprueba la PRESENCIA de la
 * cookie de sesión para redirigir rápido; la validación real contra la BD se
 * hace en los Server Components / route handlers (requireUser / requireApiUser),
 * porque Prisma no corre en el runtime edge.
 */
// /api/ads/sync y /api/ads/ingest validan sesión-ADMIN o x-ingest-token dentro
// del handler, así que el middleware los deja pasar (no puede leer el token aquí).
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/ads/ingest', '/api/ads/sync'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Recursos estáticos y rutas públicas pasan directo
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/files') ||
    pathname === '/favicon.ico' ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Aplica a todo excepto assets estáticos
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
