import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/login: el tiempo de respuesta no debe delatar si el email existe
 * y el límite de intentos corta antes de tocar la BD. Prisma, la sesión y el
 * rate-limit van simulados; bcrypt es el real.
 */

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
const createSession = vi.hoisted(() => vi.fn());
const checkLoginRateLimit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/auth/session', () => ({ createSession }));
vi.mock('@/lib/auth/rate-limit', () => ({ checkLoginRateLimit }));
vi.mock('@/lib/auth/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/password')>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

import { POST } from '@/app/api/auth/login/route';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '@/lib/auth/password';

const login = (email: string, password: string) =>
  POST(
    new Request('https://winspy.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({ email, password }),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  checkLoginRateLimit.mockResolvedValue('allowed');
});

describe('login: sin diferencia observable si el email existe', () => {
  it('email inexistente: compara igualmente contra el hash fijo y responde 401', async () => {
    db.user.findUnique.mockResolvedValue(null);
    const res = await login('nadie@winspy.test', 'secreta');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Credenciales inválidas' });
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(verifyPassword).toHaveBeenCalledWith('secreta', DUMMY_PASSWORD_HASH);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('email existente con contraseña incorrecta: misma respuesta, contra su hash', async () => {
    const passwordHash = await hashPassword('correcta');
    db.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash });
    const res = await login('Socio@Winspy.test', 'secreta');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Credenciales inválidas' });
    expect(verifyPassword).toHaveBeenCalledWith('secreta', passwordHash);
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: 'socio@winspy.test' } });
  });

  it('credenciales correctas: crea la sesión', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: await hashPassword('correcta') });
    const res = await login('socio@winspy.test', 'correcta');
    expect(res.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith('u1');
  });

  it('el hash fijo es bcrypt del mismo coste que las contraseñas reales y no valida nada', async () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(bcrypt.getRounds(await hashPassword('x')));
    expect(await bcrypt.compare('', DUMMY_PASSWORD_HASH)).toBe(false);
    expect(await bcrypt.compare('secreta', DUMMY_PASSWORD_HASH)).toBe(false);
  });
});

describe('login: límite de intentos', () => {
  it('429 al superar el límite, sin consultar la BD', async () => {
    checkLoginRateLimit.mockResolvedValue('limited');
    const res = await login('socio@winspy.test', 'x');
    expect(res.status).toBe(429);
    expect(checkLoginRateLimit).toHaveBeenCalledWith('203.0.113.7');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('503 si el límite no se puede comprobar (falla cerrado), sin consultar la BD', async () => {
    checkLoginRateLimit.mockResolvedValue('unavailable');
    const res = await login('socio@winspy.test', 'x');
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('60');
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });
});
