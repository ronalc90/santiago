import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo, LookupFunction } from 'node:net';

/**
 * Protección SSRF de la descarga de creativos (lib/services/creative.ts).
 * Sin red externa: el DNS va simulado y las descargas apuntan a un servidor local.
 */

const dnsLookup = vi.hoisted(() => vi.fn());
vi.mock('dns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dns')>();
  return { ...actual, default: { ...actual, lookup: dnsLookup }, lookup: dnsLookup };
});
vi.mock('@/lib/storage', () => ({ getStorage: () => ({ put: vi.fn() }) }));
vi.mock('@/lib/images/compress', () => ({ compressToWebp: vi.fn() }));

import {
  assertPublicHttpUrl,
  downloadCreative,
  isBlockedAddress,
  persistCreative,
  safeLookup,
} from '@/lib/services/creative';

/** Simula dns.lookup devolviendo `addrs`, respetando la forma pedida (all o no). */
function resolveTo(...addrs: string[]) {
  return (_host: string, opts: { all?: boolean }, cb: (...args: unknown[]) => void) => {
    const list = addrs.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    if (opts?.all) cb(null, list);
    else cb(null, list[0]!.address, list[0]!.family);
  };
}

/** lookup SIN validación hacia 127.0.0.1: solo para probar la mecánica HTTP. */
const toLocalServer: LookupFunction = (_host, opts, cb) => {
  if (opts.all) cb(null, [{ address: '127.0.0.1', family: 4 }]);
  else cb(null, '127.0.0.1', 4);
};

describe('isBlockedAddress: IPv4', () => {
  it.each([
    '0.0.0.0',
    '0.255.255.255',
    '10.0.0.1',
    '100.64.0.0',
    '100.127.255.255',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.170',
    '192.0.2.10',
    '192.88.99.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.19.255.255',
    '198.51.100.7',
    '203.0.113.9',
    '224.0.0.1',
    '239.255.255.250',
    '240.0.0.1',
    '255.255.255.255',
  ])('bloquea %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '157.240.22.35', // Meta
    '100.63.255.255',
    '100.128.0.0',
    '172.15.255.255',
    '172.32.0.0',
    '192.0.1.1',
    '198.17.255.255',
    '198.20.0.0',
    '223.255.255.255',
  ])('permite %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe('isBlockedAddress: IPv6', () => {
  it.each([
    '::',
    '::1',
    '::7f00:1', // IPv4-compatible obsoleta
    '::ffff:127.0.0.1',
    '::ffff:7f00:1', // misma, en notación hex (así la serializa new URL)
    '::ffff:a9fe:a9fe', // 169.254.169.254 mapeada
    '::ffff:10.0.0.1',
    '::ffff:0:7f00:1', // IPv4-translated
    '64:ff9b::7f00:1', // NAT64 → 127.0.0.1
    '64:ff9b::169.254.169.254', // NAT64 → metadata
    '64:ff9b::c612:1', // NAT64 → 198.18.0.1
    '64:ff9b:1::808:808', // NAT64 local
    '100::1',
    '2001::1', // Teredo
    '2001:db8::1',
    '2002:7f00:1::1', // 6to4 de 127.0.0.1
    '3fff::1',
    '5f00::1',
    'fc00::1',
    'fd12:3456:789a::1',
    'fe80::1',
    'febf::1', // fe80::/10 completo (no solo el prefijo textual "fe80")
    'fe80::1%eth0',
    'fec0::1',
    'ff02::1',
  ])('bloquea %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    '2a03:2880:f12f:83:face:b00c:0:25de', // Meta
    '2001:4860:4860::8888',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
    '64:ff9b::808:808', // NAT64 hacia una IPv4 pública
  ])('permite %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it('lo que no es una IP se trata como no permitido', () => {
    expect(isBlockedAddress('no-es-ip')).toBe(true);
    expect(isBlockedAddress('')).toBe(true);
  });
});

describe('assertPublicHttpUrl', () => {
  it.each(['file:///etc/passwd', 'ftp://example.com/x', 'gopher://example.com/', 'data:text/plain,hola'])(
    'rechaza el esquema de %s',
    (url) => {
      expect(() => assertPublicHttpUrl(url)).toThrow(/esquema no permitido/);
    },
  );

  it.each([
    'http://127.0.0.1/',
    'http://0x7f.1/', // 127.0.0.1 en notación rara
    'http://2130706433/', // 127.0.0.1 como entero
    'http://169.254.169.254/latest/meta-data/',
    'http://198.18.0.1/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[64:ff9b::a9fe:a9fe]/',
    'http://[fe80::1]/',
  ])('rechaza la IP literal de %s', (url) => {
    expect(() => assertPublicHttpUrl(url)).toThrow(/IP no permitida/);
  });

  it('acepta nombres de host (se validan al conectar) e IPs públicas', () => {
    expect(assertPublicHttpUrl('https://scontent.xx.fbcdn.net/v/t1.jpg?oh=1').hostname).toBe('scontent.xx.fbcdn.net');
    expect(() => assertPublicHttpUrl('https://[2a03:2880:f12f:83:face:b00c:0:25de]/x.jpg')).not.toThrow();
    expect(() => assertPublicHttpUrl('http://8.8.8.8/')).not.toThrow();
  });

  it('rechaza URLs inválidas', () => {
    expect(() => assertPublicHttpUrl('no es una url')).toThrow(/inválida/);
  });
});

describe('safeLookup (validación en el momento de conectar)', () => {
  beforeEach(() => {
    dnsLookup.mockReset();
  });

  const run = (all: boolean) =>
    new Promise<{ err: Error | null; address: unknown }>((resolve) => {
      safeLookup('cdn.example', { all }, (err, address) => resolve({ err, address }));
    });

  it('deja pasar si todas las IPs son públicas', async () => {
    dnsLookup.mockImplementation(resolveTo('157.240.22.35', '2a03:2880:f12f:83:face:b00c:0:25de'));
    const { err, address } = await run(true);
    expect(err).toBeNull();
    expect(address).toHaveLength(2);
  });

  it('rechaza si CUALQUIERA de las IPs es interna', async () => {
    dnsLookup.mockImplementation(resolveTo('157.240.22.35', '10.0.0.5'));
    const { err } = await run(true);
    expect(err?.message).toMatch(/IP no permitida \(10\.0\.0\.5\)/);
  });

  it('también valida la forma de una sola dirección', async () => {
    dnsLookup.mockImplementation(resolveTo('::ffff:169.254.169.254'));
    const { err } = await run(false);
    expect(err?.message).toMatch(/IP no permitida/);
  });

  it('una resolución vacía es un error', async () => {
    dnsLookup.mockImplementation((_h: string, _o: unknown, cb: (...a: unknown[]) => void) => cb(null, []));
    const { err } = await run(true);
    expect(err?.message).toMatch(/no se pudo resolver/);
  });
});

describe('descarga contra un servidor local', () => {
  let server: http.Server;
  let base: string;
  const hits: string[] = [];
  const routes: Record<string, (res: http.ServerResponse) => void> = {
    '/ok.jpg': (res) => {
      res.writeHead(200, { 'content-type': 'image/jpeg' });
      res.end(Buffer.from('JPEGDATA'));
    },
    '/redirect': (res) => {
      res.writeHead(302, { location: '/ok.jpg' });
      res.end();
    },
    '/gone': (res) => {
      res.writeHead(404);
      res.end();
    },
    '/boom': (res) => {
      res.writeHead(500);
      res.end();
    },
    '/empty': (res) => {
      res.writeHead(200);
      res.end();
    },
    '/big': (res) => {
      res.writeHead(200, { 'content-type': 'video/mp4' });
      res.end(Buffer.alloc(64, 1));
    },
  };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      hits.push(req.url ?? '');
      (routes[req.url ?? ''] ?? routes['/gone']!)(res);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://cdn.example:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  beforeEach(() => {
    hits.length = 0;
    dnsLookup.mockReset();
  });

  it('un host que resuelve a loopback se corta ANTES de conectar (sin petición)', async () => {
    dnsLookup.mockImplementation(resolveTo('127.0.0.1'));
    await expect(persistCreative('ad1', `${base}/ok.jpg`, 'image')).rejects.toThrow(/IP no permitida \(127\.0\.0\.1\)/);
    expect(hits).toEqual([]);
    // Anti DNS rebinding: hay UNA sola resolución (la que usa el propio socket),
    // no una para validar y otra para conectar. Tampoco se reintenta.
    expect(dnsLookup).toHaveBeenCalledTimes(1);
  });

  it('descarga el binario y su content-type', async () => {
    const out = await downloadCreative(`${base}/ok.jpg`, { lookup: toLocalServer });
    expect(out.buffer.toString()).toBe('JPEGDATA');
    expect(out.contentType).toBe('image/jpeg');
  });

  it('no sigue redirecciones', async () => {
    await expect(downloadCreative(`${base}/redirect`, { lookup: toLocalServer })).rejects.toThrow(/redirige \(302\)/);
    expect(hits).toEqual(['/redirect']);
  });

  it('404 no se reintenta; 5xx sí', async () => {
    await expect(downloadCreative(`${base}/gone`, { lookup: toLocalServer })).rejects.toThrow(/respondió 404/);
    expect(hits).toEqual(['/gone']);
    hits.length = 0;
    await expect(downloadCreative(`${base}/boom`, { lookup: toLocalServer })).rejects.toThrow(/respondió 500/);
    expect(hits).toEqual(['/boom', '/boom']);
  });

  it('rechaza cuerpos vacíos o por encima del tope', async () => {
    await expect(downloadCreative(`${base}/empty`, { lookup: toLocalServer })).rejects.toThrow(/vacío/);
    await expect(downloadCreative(`${base}/big`, { lookup: toLocalServer, maxBytes: 16 })).rejects.toThrow(/excede 16 bytes/);
  });
});
