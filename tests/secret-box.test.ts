import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../lib/crypto/secret-box';

describe('secret-box (AES-256-GCM)', () => {
  it('roundtrip: descifra exactamente lo que cifra y no filtra el texto plano', () => {
    const plain = 'APP_USR-123456-refresh-token-abcdef';
    const blob = encryptSecret(plain);
    expect(blob).not.toContain(plain);
    expect(blob.startsWith('v1.')).toBe(true);
    expect(decryptSecret(blob)).toBe(plain);
  });

  it('cada cifrado usa un IV distinto (no determinista)', () => {
    expect(encryptSecret('mismo')).not.toBe(encryptSecret('mismo'));
  });

  it('un blob manipulado lanza (el tag GCM detecta la alteración)', () => {
    const parts = encryptSecret('secreto').split('.');
    const tampered = [parts[0], parts[1], parts[2], Buffer.from('manipulado').toString('base64')].join('.');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('formato inválido lanza', () => {
    expect(() => decryptSecret('no-es-un-blob')).toThrow('inválido');
  });

  it('rechaza un tag GCM truncado (no debilita la integridad)', () => {
    const parts = encryptSecret('secreto').split('.');
    const shortTag = Buffer.from('aaaa', 'base64').toString('base64'); // < 16 bytes
    const tampered = [parts[0], parts[1], shortTag, parts[3]].join('.');
    expect(() => decryptSecret(tampered)).toThrow('inválido');
  });
});
