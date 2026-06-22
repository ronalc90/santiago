import { getEnv } from '@/lib/config/env';

/**
 * Cliente de la API de Integraciones de Dropi (api.dropi.co) para traer el
 * catálogo de productos automáticamente (alternativa al CSV).
 *
 * Flujo REAL (el que usan los plugins oficiales tipo Dropify, verificado contra
 * el plugin open-source wc-dropi-integration):
 *  - Auth: header `dropi-integration-key` = el TOKEN de Integración que generas en
 *    app.dropi.co → Integraciones. No hay login email/clave ni whitelist de IP.
 *  - Catálogo: POST {base}/integrations/products/index con
 *    { startData(page), pageSize, order_by, order_type, keywords, active,
 *      no_count, integration, get_stock } → { isSuccess, objects: [...] }.
 *
 * El parser es tolerante (nombres de campo en es/en, envoltorios) por si el
 * esquema varía entre países/versiones.
 */
export interface DropiProduct {
  name: string;
  sku: string | null;
  category: string | null;
  cost: number | null;
  stock: number | null;
  imageUrl: string | null;
}

/** ¿Hay token para usar la API? Si no, se usa el CSV. */
export function isDropiApiConfigured(): boolean {
  return Boolean(getEnv().DROPI_INTEGRATION_KEY);
}

/** Enlace al panel de Dropi buscando el producto por nombre (de donde sale el dato). */
export function dropiPanelSearchUrl(query: string): string {
  return `${getEnv().DROPI_PANEL_URL}?keywords=${encodeURIComponent(query.trim())}`;
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

function mapProduct(raw: Json): DropiProduct | null {
  const name = str(pick(raw, 'name', 'nombre', 'title', 'titulo', 'product_name'));
  if (!name) return null;
  const gallery = pick(raw, 'gallery', 'images', 'imagenes');
  const firstImg = Array.isArray(gallery) ? str(asRecord(gallery[0]).url ?? gallery[0]) : null;
  return {
    name,
    // En Dropi el identificador del producto es `id`; lo guardamos como referencia.
    sku: str(pick(raw, 'sku', 'reference', 'referencia', 'code', 'codigo', 'id')),
    category: str(pick(raw, 'category', 'categoria', 'category_name')) ?? str(asRecord(pick(raw, 'category')).name),
    // `sale_price` = precio al dropshipper (nuestro costo para el margen).
    cost: toInt(pick(raw, 'sale_price', 'price', 'precio', 'cost', 'costo', 'suggested_price')),
    stock: toInt(pick(raw, 'stock', 'inventory', 'inventario', 'quantity', 'existencias')),
    imageUrl: str(pick(raw, 'image', 'imagen', 'image_url', 'imageUrl', 'main_image', 'foto')) ?? firstImg,
  };
}

/** Parsea una respuesta del catálogo (cualquier forma soportada) a productos. */
export function parseDropiProducts(data: unknown): DropiProduct[] {
  return extractList(data)
    .map(mapProduct)
    .filter((p): p is DropiProduct => p !== null);
}

/**
 * Trae el catálogo de productos de Dropi, paginando hasta `maxPages`. Pide los
 * más nuevos primero (order_by created_at desc). Se detiene cuando una página
 * viene vacía o más corta que `pageSize`.
 */
export async function fetchDropiProducts(maxPages = 50, pageSize = 100): Promise<DropiProduct[]> {
  const env = getEnv();
  const key = env.DROPI_INTEGRATION_KEY;
  if (!key) throw new Error('Falta DROPI_INTEGRATION_KEY (genera el token en app.dropi.co → Integraciones).');

  const url = `${env.DROPI_API_BASE_URL}${env.DROPI_PRODUCTS_PATH}`;
  const headers = { 'Content-Type': 'application/json;charset=UTF-8', 'dropi-integration-key': key };
  const seen = new Set<string>();
  const out: DropiProduct[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startData: page,
        pageSize,
        order_by: 'created_at',
        order_type: 'desc',
        keywords: '',
        active: true,
        no_count: true,
        integration: true,
        get_stock: false,
      }),
    });
    const json = asRecord(await res.json().catch(() => ({})));
    if (!res.ok || json.isSuccess === false) {
      const msg = String(json.message ?? `HTTP ${res.status}`);
      const callerIp = json.ip ? String(json.ip) : null;
      const isAuth = Number(json.status) === 401 || res.status === 401 || /access denied|denied|unauthor/i.test(msg);
      if (isAuth) {
        throw new Error(
          `Dropi denegó el acceso (Access denied)` +
            (callerIp ? ` desde ${callerIp}` : '') +
            `. Dropi no autoriza el consumo directo de su API para integraciones propias (lo confirmó su soporte). ` +
            `Usa el catálogo por CSV: exporta tus productos/favoritos desde el panel de Dropi e impórtalos aquí.`,
        );
      }
      throw new Error(`Dropi rechazó la consulta: ${msg}.`);
    }

    const rawList = extractList(json);
    if (rawList.length === 0) break;
    for (const raw of rawList) {
      const p = mapProduct(raw);
      if (p && !seen.has(p.name.toLowerCase())) {
        seen.add(p.name.toLowerCase());
        out.push(p);
      }
    }
    if (rawList.length < pageSize) break; // última página
  }
  return out;
}
