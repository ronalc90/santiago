import { createHash } from 'crypto';
import { lookup as dnsLookup } from 'dns';
import http from 'http';
import https from 'https';
import { isIP, type LookupFunction } from 'net';
import { getStorage } from '@/lib/storage';
import { compressToWebp } from '@/lib/images/compress';

/**
 * Persistencia de creativos del Ad Library.
 *
 * Las URLs de imagen/video del CDN de Meta (scontent/fbcdn) van firmadas y
 * CADUCAN (videos ~1h, imágenes días). Guardar esa URL produce imágenes rotas.
 * Por eso descargamos el binario de inmediato y lo re-hospedamos en NUESTRO
 * almacenamiento (getStorage(): local o S3/R2), devolviendo una URL propia y
 * permanente que es la que se guarda en Ad.creativeUrl.
 */

const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
// Tope defensivo para no descargar binarios gigantes (videos HD de Meta pueden
// pesar bastante; 100 MB cubre la mayoría sin permitir descargas absurdas).
const MAX_BYTES = 100 * 1024 * 1024;

export type CreativeKind = 'image' | 'video';

export interface PersistedCreative {
  /** URL pública en nuestro almacenamiento (la que se muestra). */
  url: string;
  /** Clave/ruta dentro del almacenamiento. */
  key: string;
  bytes: number;
  kind: CreativeKind;
  /** URL original (efímera) del CDN de Meta, para auditoría. */
  originalUrl: string;
}

/**
 * Descarga un creativo y lo sube a nuestro almacenamiento.
 * - Imágenes: se comprimen a WebP (reutiliza lib/images/compress).
 * - Videos: se suben tal cual (mp4).
 * Lanza si la descarga falla tras los reintentos (p. ej. URL ya caducada).
 */
export async function persistCreative(
  adId: string,
  mediaUrl: string,
  kind: CreativeKind,
): Promise<PersistedCreative> {
  const raw = await downloadCreative(mediaUrl);

  let data: Buffer;
  let ext: string;
  let contentType: string;

  if (kind === 'image') {
    const compressed = await compressToWebp(raw.buffer);
    data = compressed.data;
    ext = 'webp';
    contentType = 'image/webp';
  } else {
    data = raw.buffer;
    ext = extFromContentType(raw.contentType, 'mp4');
    contentType = raw.contentType || 'video/mp4';
  }

  // sha1 del contenido → idempotencia y dedup (misma media = misma clave).
  const hash = createHash('sha1').update(data).digest('hex').slice(0, 16);
  const key = `ads/${safeSegment(adId)}/${hash}.${ext}`;
  const stored = await getStorage().put(key, data, contentType);

  return { url: stored.url, key: stored.key, bytes: stored.bytes, kind, originalUrl: mediaUrl };
}

export interface DownloadOptions {
  /**
   * Resolución DNS usada al CONECTAR. Por defecto `safeLookup` (valida la IP).
   * Solo se sustituye en tests para apuntar a un servidor local.
   */
  lookup?: LookupFunction;
  /** Tope de bytes (por defecto MAX_BYTES). */
  maxBytes?: number;
}

/** Error de descarga con indicación explícita de si merece reintento. */
class DownloadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

/** El host es (o resuelve a) una IP de un rango no permitido. Nunca se reintenta. */
class BlockedAddressError extends Error {
  constructor(addr: string) {
    super(`host resuelve a una IP no permitida (${addr})`);
    this.name = 'BlockedAddressError';
  }
}

/**
 * Descarga con timeout, reintentos, tope de tamaño y protección SSRF.
 *
 * Anti DNS rebinding: la IP se valida DENTRO de la conexión (opción `lookup` de
 * http/https), es decir, el socket se abre exactamente contra la IP que acabamos
 * de comprobar; no hay una segunda resolución que un atacante pueda rebindear
 * entre la validación y la petición. El TLS (SNI y certificado) sigue usando el
 * nombre de host, así que los CDN de Meta funcionan igual que con fetch.
 */
export async function downloadCreative(
  url: string,
  opts: DownloadOptions = {},
): Promise<{ buffer: Buffer; contentType: string }> {
  // Validación inicial: esquema e IPs literales (estas no pasan por `lookup`).
  const target = assertPublicHttpUrl(url);
  const lookup = opts.lookup ?? safeLookup;
  const maxBytes = opts.maxBytes ?? MAX_BYTES;

  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await requestOnce(target, lookup, maxBytes);
    } catch (err) {
      lastError = describeError(err);
      if (attempt < MAX_RETRIES && isRetryable(err)) {
        await sleep(500 * attempt);
        continue;
      }
      throw new Error(`No se pudo descargar el creativo: ${lastError}`);
    }
  }
  throw new Error(`No se pudo descargar el creativo: ${lastError}`);
}

/** Una petición GET sin seguir redirecciones, con tope de tamaño y timeout. */
function requestOnce(
  target: URL,
  lookup: LookupFunction,
  maxBytes: number,
): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err: Error | null, value?: { buffer: Buffer; contentType: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        req.destroy();
        reject(err);
      } else {
        resolve(value!);
      }
    };

    const options: http.RequestOptions = {
      // Conexión propia por descarga (sin pool compartido): todo socket pasa por
      // `lookup` y ninguno se reutiliza desde código ajeno a esta validación.
      agent: false,
      lookup,
      headers: { accept: '*/*', 'user-agent': 'node' },
    };

    // http/https no siguen redirecciones: un 30x no puede saltarse la validación.
    const onResponse = (res: http.IncomingMessage) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        return finish(new DownloadError(`descarga de creativo redirige (${status}); no se sigue por seguridad`, false));
      }
      if (status < 200 || status >= 300) {
        res.resume();
        // 403/404 = URL caducada o retirada: no reintentar.
        return finish(new DownloadError(`descarga de creativo respondió ${status}`, status !== 403 && status !== 404));
      }
      const declared = Number(res.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        return finish(new DownloadError(`creativo excede ${maxBytes} bytes`, false));
      }
      const chunks: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) return finish(new DownloadError(`creativo excede ${maxBytes} bytes`, false));
        chunks.push(chunk);
      });
      res.on('error', (err) => finish(err));
      res.on('end', () => {
        if (total === 0) return finish(new DownloadError('creativo vacío', false));
        finish(null, { buffer: Buffer.concat(chunks, total), contentType: String(res.headers['content-type'] ?? '') });
      });
    };

    const req =
      target.protocol === 'https:'
        ? https.get(target, options, onResponse)
        : http.get(target, options, onResponse);
    req.on('error', (err) => finish(err));
    const timer = setTimeout(
      () => finish(new DownloadError(`timeout de ${DOWNLOAD_TIMEOUT_MS} ms descargando el creativo`, true)),
      DOWNLOAD_TIMEOUT_MS,
    );
  });
}

/**
 * Reintenta solo fallos transitorios (red, timeout, 5xx…). No reintenta IPs
 * bloqueadas, redirecciones, 403/404, tamaño excedido ni hosts inexistentes.
 */
function isRetryable(err: unknown): boolean {
  if (err instanceof BlockedAddressError) return false;
  if (err instanceof DownloadError) return err.retryable;
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code !== 'ENOTFOUND';
}

function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  // Algunos errores de red esconden la causa real (DNS/TLS/conexión) en `cause`.
  const cause = (err as { cause?: unknown }).cause;
  const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : '';
  return causeMsg ? `${err.message} (${causeMsg})` : err.message;
}

function extFromContentType(ct: string, fallback: string): string {
  if (ct.includes('mp4')) return 'mp4';
  if (ct.includes('webm')) return 'webm';
  if (ct.includes('quicktime')) return 'mov';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  return fallback;
}

/** Evita path traversal / caracteres raros en la clave de almacenamiento. */
function safeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'ad';
}

/**
 * Protección SSRF (parte estática): solo http(s), y si el host es una IP literal
 * debe ser pública. Los nombres de host se validan al conectar (`safeLookup`).
 * Devuelve la URL ya parseada.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('URL de creativo inválida');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`esquema no permitido: ${u.protocol}`);
  }
  // WHATWG URL ya normaliza las IPv4 raras (0x7f.1, 2130706433 → 127.0.0.1) y
  // deja las IPv6 entre corchetes y comprimidas (::ffff:127.0.0.1 → [::ffff:7f00:1]).
  const host = u.hostname.replace(/^\[(.*)\]$/, '$1');
  if (!host) throw new Error('URL de creativo sin host');
  if (isIP(host) && isBlockedAddress(host)) throw new BlockedAddressError(host);
  return u;
}

/**
 * `lookup` para http/https que resuelve el host y rechaza la conexión si
 * CUALQUIERA de las IPs devueltas está en un rango no permitido. Como el socket
 * se conecta con el resultado de esta misma resolución, cierra la ventana de
 * DNS rebinding entre "validar" y "conectar".
 */
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);
    const list = Array.isArray(address) ? address.map((a) => a.address) : [address];
    if (list.length === 0) {
      const empty: NodeJS.ErrnoException = new Error(`no se pudo resolver el host: ${hostname}`);
      empty.code = 'ENOTFOUND';
      return callback(empty, address, family);
    }
    const blocked = list.find((a) => isBlockedAddress(a));
    if (blocked) return callback(new BlockedAddressError(blocked), address, family);
    callback(null, address, family);
  });
};

// --- Clasificación de IPs ----------------------------------------------------
// Rangos del registro IANA de direcciones de propósito especial que no son
// destinos públicos legítimos (internos, reservados, documentación, multicast…).

const BLOCKED_V4_CIDRS = [
  '0.0.0.0/8', // "esta red"
  '10.0.0.0/8', // privada (RFC 1918)
  '100.64.0.0/10', // CGNAT (RFC 6598)
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local / metadata cloud (169.254.169.254)
  '172.16.0.0/12', // privada (RFC 1918)
  '192.0.0.0/24', // asignaciones de protocolo IETF (DS-Lite, NAT64…)
  '192.0.2.0/24', // documentación TEST-NET-1
  '192.88.99.0/24', // relay 6to4 anycast (obsoleto)
  '192.168.0.0/16', // privada (RFC 1918)
  '198.18.0.0/15', // benchmarking (RFC 2544)
  '198.51.100.0/24', // documentación TEST-NET-2
  '203.0.113.0/24', // documentación TEST-NET-3
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reservado + broadcast 255.255.255.255
];

const BLOCKED_V6_CIDRS = [
  '::/96', // :: (sin especificar), ::1 (loopback) e "IPv4-compatible" obsoletas
  '::ffff:0:0:0/96', // IPv4-translated (SIIT)
  '64:ff9b:1::/48', // NAT64 de uso local (RFC 8215)
  '100::/64', // discard-only
  '2001::/23', // asignaciones IETF (Teredo, benchmarking, ORCHID…)
  '2001:db8::/32', // documentación
  '2002::/16', // 6to4 (embebe una IPv4 arbitraria)
  '3fff::/20', // documentación (RFC 9637)
  '5f00::/16', // SIDs de SRv6
  'fc00::/7', // ULA (privadas)
  'fe80::/10', // link-local
  'fec0::/10', // site-local (obsoleto)
  'ff00::/8', // multicast
];

// Prefijos /96 que llevan una IPv4 en los 32 bits finales: se evalúa esa IPv4,
// así ::ffff:127.0.0.1 o 64:ff9b::a9fe:a9fe (169.254.169.254 vía NAT64) quedan
// bloqueadas sin romper destinos públicos alcanzados por esas vías.
const EMBEDDED_V4_PREFIXES = [
  '::ffff:0:0/96', // IPv4-mapped
  '64:ff9b::/96', // NAT64 well-known prefix (RFC 6052)
];

const BLOCKED_V4 = BLOCKED_V4_CIDRS.map((c) => {
  const [base, bits] = c.split('/');
  return { base: ipv4ToInt(base!), bits: Number(bits) };
});
const toV6Range = (c: string) => {
  const [base, bits] = c.split('/');
  return { base: parseIPv6(base!)!, bits: Number(bits) };
};
const BLOCKED_V6 = BLOCKED_V6_CIDRS.map(toV6Range);
const EMBEDDED_V4 = EMBEDDED_V4_PREFIXES.map(toV6Range);

/**
 * true si la IP (v4/v6) no es un destino público permitido. Lo que no se pueda
 * interpretar como IP también se considera no permitido (falla cerrado).
 */
export function isBlockedAddress(ip: string): boolean {
  if (isIP(ip) === 4) return isBlockedV4(ipv4ToInt(ip));
  const groups = parseIPv6(ip);
  if (!groups) return true;
  if (EMBEDDED_V4.some((r) => inV6Range(groups, r.base, r.bits))) {
    return isBlockedV4(((groups[6]! << 16) >>> 0) + groups[7]!);
  }
  return BLOCKED_V6.some((r) => inV6Range(groups, r.base, r.bits));
}

function isBlockedV4(n: number): boolean {
  return BLOCKED_V4.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((base & mask) >>> 0);
  });
}

function ipv4ToInt(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number);
  return ((a! << 24) >>> 0) + (b! << 16) + (c! << 8) + d!;
}

/** Convierte una IPv6 (cualquier notación válida) en sus 8 grupos de 16 bits. */
function parseIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (isIP(s) !== 6) return null;
  // Cola IPv4 en notación decimal (::ffff:1.2.3.4) → dos grupos hex.
  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    const n = ipv4ToInt(tail);
    s = `${s.slice(0, lastColon + 1)}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, rest] = s.split('::');
  const left = head ? head.split(':') : [];
  const right = rest ? rest.split(':') : [];
  const fill = rest === undefined ? 0 : 8 - left.length - right.length;
  const groups = [...left, ...Array<string>(fill).fill('0'), ...right].map((h) => parseInt(h, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

function inV6Range(groups: number[], base: number[], bits: number): boolean {
  for (let i = 0, left = bits; i < 8 && left > 0; i += 1, left -= 16) {
    const take = Math.min(16, left);
    const mask = (0xffff << (16 - take)) & 0xffff;
    if ((groups[i]! & mask) !== (base[i]! & mask)) return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
