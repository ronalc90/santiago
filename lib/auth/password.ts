import bcrypt from 'bcryptjs';

/** Coste de bcrypt para las contraseñas (el seed usa el mismo). */
const BCRYPT_COST = 10;

/**
 * Hash bcrypt fijo (mismo coste) de un valor aleatorio que se descartó. El login
 * lo usa cuando el email no existe, para que esa respuesta haga el mismo trabajo
 * (y tarde lo mismo) que una contraseña incorrecta. Que sea público no importa:
 * sin usuario el login falla igual, coincida o no.
 */
export const DUMMY_PASSWORD_HASH = '$2a$10$sOA.7xzLiwNhBRlNn/75Be8P2INhVxaTarQ4p4lP6DxcDEM9jucJq';

/** Hashea una contraseña en texto plano. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Verifica una contraseña contra su hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
