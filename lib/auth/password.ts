import bcrypt from 'bcryptjs';

/** Hashea una contraseña en texto plano. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Verifica una contraseña contra su hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
