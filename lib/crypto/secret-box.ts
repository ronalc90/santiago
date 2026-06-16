import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { getEnv } from '@/lib/config/env';

/**
 * Cifrado simétrico autenticado (AES-256-GCM) para secretos en reposo: tokens
 * OAuth de integraciones. La clave (32 bytes) se deriva de AUTH_SECRET con
 * SHA-256, así que rotar AUTH_SECRET invalida lo cifrado (hay que reconectar).
 *
 * Formato del blob: "v1.<iv>.<tag>.<ciphertext>" (cada parte en base64). El IV
 * es aleatorio por cifrado y el tag GCM detecta cualquier manipulación (descifrar
 * un blob alterado lanza).
 */
const VERSION = 'v1';

function key(): Buffer {
  return createHash('sha256').update(getEnv().AUTH_SECRET).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
}

export function decryptSecret(blob: string): string {
  const parts = blob.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Formato de secreto cifrado inválido.');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  // GCM acepta tags truncados (4/8/12 bytes) y debilitaría la integridad: exigir
  // los tamaños canónicos (IV de 12 bytes, tag de 16) antes de descifrar.
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error('Formato de secreto cifrado inválido.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
