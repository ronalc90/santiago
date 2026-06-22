import { getEnv } from '@/lib/config/env';

/**
 * Cliente de la API de Integraciones de Dropi (api.dropi.co) para traer el
 * catálogo de productos de forma automática (alternativa al CSV manual).
 *
 * Autenticación (según la doc de integraciones de Dropi):
 *  - Token de Integraciones: header `dropi-integration-key` (se genera en
 *    app.dropi.co → Integraciones). Es lo más directo y estable.
 *  - O login email/clave → token bearer (válido ~24h) en `Authorization: Bearer`.
 *
 * Las rutas y el formato exacto de respuesta no son públicos, así que el cliente
 * es TOLERANTE (acepta varias formas de paginación y nombres de campo) y las
 * rutas se configuran por env. Si el endpoint difiere, se ajusta sin tocar código.
 */
export interface DropiProduct {
  name: string;
  sku: string | null;
  category: string | null;
  cost: number | null;
  stock: number | null;
  imageUrl: string | null;
}

/** ¿Hay credenciales para usar la API? Si no, se usa el CSV. */
export function isDropiApiConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.DROPI_INTEGRATION_KEY || (env.DROPI_EMAIL && env.DROPI_PASSWORD));
}

type Json = Record<string, unknown>;
const asRecord = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

function toInt(v: unknown): number | null {
  if (v == null) return null;
  // Los números reales se respetan; las cadenas se limpian quitando TODO lo no
  // numérico. El COP es entero (sin centavos) y usa "." de miles, así que
  // "18.000"/"$ 18.000 COP" → 18000 (no 18).
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  const digits = String(v).replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
}
function str(v: unknown): string | null {
  const s = v == null ? '' : String(v).trim();
  return s || null;
}
/** Primer valor no vacío entre varias claves candidatas. */
function pick(o: Json, ...keys: string[]): unknown {
  for (const k of keys) if (o[k] != null && o[k] !== '') return o[k];
  return undefined;
}

/** Login email/clave → token bearer. */
async function login(): Promise<string> {
  const env = getEnv();
  const res = await fetch(`${env.DROPI_API_BASE_URL}${env.DROPI_LOGIN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.DROPI_EMAIL, password: env.DROPI_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login Dropi falló (HTTP ${res.status}). Revisa DROPI_EMAIL/DROPI_PASSWORD y DROPI_LOGIN_PATH.`);
  const data = asRecord(await res.json().catch(() => ({})));
  const token =
    pick(data, 'token', 'access_token', 'accessToken') ?? pick(asRecord(data.data), 'token', 'access_token');
  if (!token || typeof token !== 'string') throw new Error('Login Dropi: la respuesta no trae token.');
  return token;
}

function authHeaders(token: string | null): Record<string, string> {
  const env = getEnv();
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (env.DROPI_INTEGRATION_KEY) h['dropi-integration-key'] = env.DROPI_INTEGRATION_KEY;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Extrae la lista de productos de respuestas con formatos distintos. */
function extractList(data: unknown): Json[] {
  if (Array.isArray(data)) return data.map(asRecord);
  const o = asRecord(data);
  for (const k of ['objects', 'data', 'products', 'items', 'results', 'rows']) {
    const v = o[k];
    if (Array.isArray(v)) return v.map(asRecord);
  }
  const nested = asRecord(o.data);
  for (const k of ['objects', 'products', 'items', 'rows']) {
    const v = nested[k];
    if (Array.isArray(v)) return v.map(asRecord);
  }
  return [];
}

/** Parsea una respuesta del catálogo (cualquier forma soportada) a productos. */
export function parseDropiProducts(data: unknown): DropiProduct[] {
  return extractList(data)
    .map(mapProduct)
    .filter((p): p is DropiProduct => p !== null);
}

function mapProduct(raw: Json): DropiProduct | null {
  const name = str(pick(raw, 'name', 'nombre', 'title', 'titulo', 'product_name'));
  if (!name) return null;
  const gallery = pick(raw, 'gallery', 'images', 'imagenes');
  const firstImg = Array.isArray(gallery) ? str(asRecord(gallery[0]).url ?? gallery[0]) : null;
  return {
    name,
    sku: str(pick(raw, 'sku', 'reference', 'referencia', 'code', 'codigo')),
    category: str(pick(raw, 'category', 'categoria', 'category_name')) ?? str(asRecord(pick(raw, 'category')).name),
    cost: toInt(pick(raw, 'sale_price', 'price', 'precio', 'cost', 'costo', 'suggested_price')),
    stock: toInt(pick(raw, 'stock', 'inventory', 'inventario', 'quantity', 'existencias')),
    imageUrl: str(pick(raw, 'image', 'imagen', 'image_url', 'imageUrl', 'main_image', 'foto')) ?? firstImg,
  };
}

/**
 * Trae el catálogo de productos de Dropi, paginando hasta `maxPages`. Se detiene
 * cuando una página viene vacía o más corta que `pageSize`.
 */
export async function fetchDropiProducts(maxPages = 50, pageSize = 100): Promise<DropiProduct[]> {
  const env = getEnv();
  const token = env.DROPI_INTEGRATION_KEY ? null : await login();
  const headers = authHeaders(token);
  const seen = new Set<string>();
  const out: DropiProduct[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetch(`${env.DROPI_API_BASE_URL}${env.DROPI_PRODUCTS_PATH}`, {
      method: 'POST',
      headers,
      // Distintas variantes de paginación: la API ignora las que no use.
      body: JSON.stringify({ pageSize, page, startData: (page - 1) * pageSize, limit: pageSize, offset: (page - 1) * pageSize }),
    });
    if (!res.ok) throw new Error(`Catálogo Dropi falló (HTTP ${res.status}). Revisa DROPI_PRODUCTS_PATH/credenciales.`);
    const rawList = extractList(await res.json().catch(() => ({})));
    if (rawList.length === 0) break;
    for (const raw of rawList) {
      const p = mapProduct(raw);
      if (p && !seen.has(p.name.toLowerCase())) {
        seen.add(p.name.toLowerCase());
        out.push(p);
      }
    }
    // Fin de paginación: la página vino más corta que el tamaño pedido.
    if (rawList.length < pageSize) break;
  }
  return out;
}
