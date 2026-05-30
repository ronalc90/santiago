import { createHash } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
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
  const raw = await download(mediaUrl);

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

/** Descarga con timeout, reintentos, tope de tamaño y protección SSRF. */
async function download(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  await assertPublicHttpUrl(url);
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      // redirect:'manual' evita que un 30x salte la validación anti-SSRF.
      const res = await fetch(url, { signal: controller.signal, redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        throw new Error(`descarga de creativo redirige (${res.status}); no se sigue por seguridad`);
      }
      if (!res.ok) {
        lastError = `descarga de creativo respondió ${res.status}`;
        // 403/404 = URL caducada o retirada: no reintentar.
        if (res.status === 403 || res.status === 404) throw new Error(lastError);
        if (attempt < MAX_RETRIES) {
          await sleep(500 * attempt);
          continue;
        }
        throw new Error(lastError);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error('creativo vacío');
      if (buf.length > MAX_BYTES) throw new Error(`creativo excede ${MAX_BYTES} bytes`);
      return { buffer: buf, contentType: res.headers.get('content-type') ?? '' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = message;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (attempt < MAX_RETRIES && (isAbort || message.includes('fetch') || message.includes('network'))) {
        await sleep(500 * attempt);
        continue;
      }
      throw new Error(`No se pudo descargar el creativo: ${lastError}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`No se pudo descargar el creativo: ${lastError}`);
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
 * Protección SSRF: solo http(s) y solo hosts que NO resuelvan a IPs
 * privadas/reservadas (loopback, link-local/metadata 169.254.x, RFC1918…).
 * Evita que el worker descargue recursos internos a partir de una URL hostil.
 */
async function assertPublicHttpUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('URL de creativo inválida');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`esquema no permitido: ${u.protocol}`);
  }
  const host = u.hostname;
  const direct = isIP(host);
  const addrs = direct
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addrs.length === 0) throw new Error(`no se pudo resolver el host: ${host}`);
  for (const addr of addrs) {
    if (isPrivateAddress(addr)) {
      throw new Error(`host resuelve a una IP no permitida (${addr})`);
    }
  }
}

/** true si la IP (v4/v6) cae en un rango privado/reservado/loopback. */
function isPrivateAddress(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) → evalúa la parte v4.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateAddress(mapped[1]);

  if (isIP(ip) === 4) {
    const o = ip.split('.').map(Number);
    if (o[0] === 10) return true; // 10.0.0.0/8
    if (o[0] === 127) return true; // 127.0.0.0/8 loopback
    if (o[0] === 0) return true; // 0.0.0.0/8
    if (o[0] === 169 && o[1] === 254) return true; // 169.254.0.0/16 link-local/metadata
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true; // 172.16.0.0/12
    if (o[0] === 192 && o[1] === 168) return true; // 192.168.0.0/16
    if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return true; // 100.64.0.0/10 CGNAT
    return false;
  }

  // IPv6
  const v6 = ip.toLowerCase();
  if (v6 === '::1' || v6 === '::') return true; // loopback / unspecified
  if (v6.startsWith('fe80')) return true; // link-local
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // fc00::/7 ULA
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
