import 'server-only';
import { getEnv } from '@/lib/config/env';
import type { ShopifyProduct } from '@/lib/services/shopify-export';

/**
 * Cliente de la Admin API de Shopify (REST). No conoce Prisma ni Next: recibe el
 * objeto neutral `ShopifyProduct` (lo arma `buildShopifyProduct`) y crea el
 * producto. El token vive SOLO en el servidor (`server-only` + getEnv); nunca se
 * loguea ni se expone al cliente.
 *
 * Nota: la REST de productos está marcada "legacy" por Shopify pero funciona para
 * apps custom mono-variante; cuando haga falta, migrar a GraphQL `productSet` sin
 * cambiar esta interfaz (`createProduct`).
 */
const STORE_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 15_000;
// Se envían las 9 imágenes a la galería (paridad con el CSV). Cambiar a false
// para usar solo el hero como imagen del producto.
const INCLUDE_GALLERY = true;

export type ShopifyErrorKind = 'credentials' | 'payload' | 'rate_limit' | 'server' | 'network';

/** Error de la Admin API, clasificado para que la ruta mapee el status HTTP. */
export class ShopifyApiError extends Error {
  kind: ShopifyErrorKind;
  status?: number;
  constructor(message: string, kind: ShopifyErrorKind, status?: number) {
    super(message);
    this.name = 'ShopifyApiError';
    this.kind = kind;
    this.status = status;
  }
}

export interface CreatedShopifyProduct {
  id: string;
  handle: string;
  adminUrl: string;
}

/** Costo por artículo de un producto de Shopify (primera variante). */
export interface ShopifyCostRow {
  shopifyProductId: string; // id numérico (no el gid)
  title: string;
  handle: string;
  sku: string | null;
  unitCost: number | null; // redondeado a entero (moneda de la tienda)
}

interface ProductsGqlResponse {
  data?: {
    products?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      nodes?: Array<{
        id?: string;
        title?: string;
        handle?: string;
        variants?: { nodes?: Array<{ sku?: string | null; inventoryItem?: { unitCost?: { amount?: string } | null } | null }> };
      }>;
    };
  };
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  // GraphQL "cost": el rate-limit es un leaky-bucket; cuando se agota, Shopify
  // responde HTTP 200 con errors[].extensions.code='THROTTLED' (no un 429).
  extensions?: {
    cost?: {
      requestedQueryCost?: number;
      throttleStatus?: { maximumAvailable?: number; currentlyAvailable?: number; restoreRate?: number };
    };
  };
}

const MAX_THROTTLE_RETRIES = 4;

/** True si hay credenciales para publicar por Admin API (gating de la feature). */
export function isShopifyConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.SHOPIFY_STORE_DOMAIN) && Boolean(env.SHOPIFY_ADMIN_TOKEN);
}

/**
 * True si, además de Shopify configurado, las imágenes se sirven por https. Shopify
 * descarga las imágenes por URL, así que con almacenamiento local (http) no podría
 * ingerirlas: en ese caso la UI desactiva el botón para no prometer lo imposible.
 */
export function canPublishToShopify(): boolean {
  if (!isShopifyConfigured()) return false;
  const env = getEnv();
  const base = env.STORAGE_DRIVER === 's3' ? env.S3_PUBLIC_BASE_URL : env.STORAGE_PUBLIC_BASE_URL;
  return /^https:\/\//.test(base);
}

/** URL del producto en el admin de Shopify (o null si no hay dominio). */
export function shopifyAdminUrlFor(productId: string): string | null {
  const domain = getEnv().SHOPIFY_STORE_DOMAIN;
  return domain ? `https://${domain}/admin/products/${productId}` : null;
}

/** Mapea el producto neutral al payload de la Admin API REST (`products.json`). */
export function toAdminApiProduct(product: ShopifyProduct) {
  const images = INCLUDE_GALLERY ? product.images : product.images.slice(0, 1);
  return {
    product: {
      title: product.title,
      body_html: product.bodyHtml,
      vendor: product.vendor,
      tags: product.tags,
      status: product.status,
      handle: product.handle,
      images: images.map((i) => ({ src: i.src, alt: i.alt, position: i.position })),
      variants: [
        {
          price: product.price,
          // OMITIR compare_at_price cuando viene '' (regular <= oferta): enviar '' da 422.
          ...(product.compareAtPrice ? { compare_at_price: product.compareAtPrice } : {}),
          inventory_policy: 'deny',
          requires_shipping: true,
          taxable: true,
        },
      ],
    },
  };
}

interface ProductsResponse {
  product?: { id?: number | string; handle?: string };
}

export class ShopifyClient {
  private domain: string;
  private token: string;
  private version: string;

  constructor() {
    const env = getEnv();
    if (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_ADMIN_TOKEN) {
      throw new ShopifyApiError('Shopify no está configurado.', 'credentials');
    }
    // Defensa en profundidad anti-SSRF: revalidar el dominio antes de cualquier fetch.
    if (!STORE_DOMAIN_RE.test(env.SHOPIFY_STORE_DOMAIN)) {
      throw new ShopifyApiError('Dominio de Shopify inválido.', 'credentials');
    }
    this.domain = env.SHOPIFY_STORE_DOMAIN;
    this.token = env.SHOPIFY_ADMIN_TOKEN;
    this.version = env.SHOPIFY_API_VERSION;
  }

  /** Crea el producto (1 variante borrador + imágenes por URL) en un POST. */
  async createProduct(product: ShopifyProduct): Promise<CreatedShopifyProduct> {
    const url = `https://${this.domain}/admin/api/${this.version}/products.json`;
    const body = JSON.stringify(toAdminApiProduct(product));
    const data = (await this.post(url, body)) as ProductsResponse;
    const created = data.product;
    if (!created?.id) {
      throw new ShopifyApiError('Shopify no devolvió el producto creado.', 'server');
    }
    return {
      id: String(created.id),
      handle: String(created.handle ?? product.handle),
      adminUrl: `https://${this.domain}/admin/products/${created.id}`,
    };
  }

  /**
   * Lee el costo por artículo (inventoryItem.unitCost) de todos los productos vía
   * Admin GraphQL, paginado. Requiere scope `read_inventory`: si falta, Shopify
   * responde con ACCESS_DENIED citando read_inventory y se devuelve
   * missingInventoryScope=true (no falla en silencio). Cualquier OTRO error de
   * GraphQL se propaga como ShopifyApiError (no se disfraza de "falta scope").
   * El THROTTLED (HTTP 200, no lo ve `post`) se reintenta aquí esperando la
   * recarga del leaky-bucket; los 429/5xx de transporte los cubre `post`.
   */
  async fetchAllProductCosts(): Promise<{ rows: ShopifyCostRow[]; missingInventoryScope: boolean }> {
    const url = `https://${this.domain}/admin/api/${this.version}/graphql.json`;
    const query =
      'query($cursor: String){ products(first: 100, after: $cursor){ pageInfo{ hasNextPage endCursor } nodes{ id title handle variants(first: 1){ nodes{ sku inventoryItem{ unitCost{ amount } } } } } } }';
    const rows: ShopifyCostRow[] = [];
    let cursor: string | null = null;
    let throttleRetries = 0;
    let pages = 0;

    while (pages < 200) {
      const body = (await this.post(url, JSON.stringify({ query, variables: { cursor } }))) as ProductsGqlResponse;

      if (body.errors?.length) {
        // THROTTLED: reintentar la MISMA página (sin avanzar cursor) tras esperar
        // la recarga del bucket; solo abortar si se agotan los reintentos.
        if (body.errors.some((e) => e.extensions?.code === 'THROTTLED' || /throttled/i.test(e.message ?? ''))) {
          if (throttleRetries >= MAX_THROTTLE_RETRIES) {
            throw new ShopifyApiError('Shopify GraphQL: throttled tras varios reintentos.', 'rate_limit');
          }
          throttleRetries += 1;
          await sleep(throttleWaitMs(body));
          continue;
        }
        // Falta read_inventory: ACCESS_DENIED (o "access denied") que cita read_inventory
        // EN EL MISMO error. No basta con que el blob mencione "unitCost" (siempre está
        // en la query): eso convertía errores transitorios en un no-op silencioso.
        if (body.errors.some((e) => {
          const msg = (e.message ?? '').toLowerCase();
          return (e.extensions?.code === 'ACCESS_DENIED' || msg.includes('access denied')) && msg.includes('read_inventory');
        })) {
          return { rows: [], missingInventoryScope: true };
        }
        throw new ShopifyApiError(`Shopify GraphQL: ${body.errors[0]?.message ?? 'error'}`, 'server');
      }
      throttleRetries = 0;

      const products = body.data?.products;
      if (!products) break;
      for (const node of products.nodes ?? []) {
        const variant = node.variants?.nodes?.[0];
        const amount = variant?.inventoryItem?.unitCost?.amount;
        // Costo > 0: un 0/negativo/no-numérico se trata como "no cargado" (null) para
        // que el margen caiga a estimado en vez de premiarse como margen real del 100%.
        const n = amount != null ? Number(amount) : NaN;
        const cost = amount != null && amount !== '' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
        rows.push({
          shopifyProductId: String(node.id ?? '').split('/').pop() ?? '',
          title: node.title ?? '',
          handle: node.handle ?? '',
          sku: variant?.sku ?? null,
          unitCost: cost,
        });
      }
      pages += 1;
      if (!products.pageInfo?.hasNextPage) break;
      cursor = products.pageInfo.endCursor ?? null;
    }
    return { rows, missingInventoryScope: false };
  }

  /** POST con timeout y reintentos acotados (solo 429/5xx). Clasifica los errores. */
  private async post(url: string, body: string): Promise<unknown> {
    let lastError = '';
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': this.token, 'Content-Type': 'application/json' },
          body,
          redirect: 'manual', // no seguir redirects a hosts arbitrarios
          signal: controller.signal,
        });
        if (res.ok) return await res.json();

        if (res.status === 401 || res.status === 403) {
          throw new ShopifyApiError(
            res.status === 403 ? 'Token sin permiso write_products.' : 'Credenciales de Shopify inválidas.',
            'credentials',
            res.status,
          );
        }
        if (res.status === 422) {
          const detail = await safeErrorDetail(res);
          throw new ShopifyApiError(`Datos rechazados por Shopify${detail ? `: ${detail}` : ''}.`, 'payload', 422);
        }
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          await sleep(res.status === 429 ? retryAfterMs(res) : backoffMs(attempt));
          continue;
        }
        throw new ShopifyApiError(
          `Shopify respondió ${res.status}.`,
          res.status === 429 ? 'rate_limit' : 'server',
          res.status,
        );
      } catch (err) {
        if (err instanceof ShopifyApiError) throw err;
        // Aquí solo llegan errores de transporte/timeout (los HTTP ya se relanzaron
        // como ShopifyApiError): se reintenta cualquiera mientras queden intentos.
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const causeCode = (err as { cause?: { code?: string } })?.cause?.code;
        lastError = isAbort
          ? `Timeout tras ${REQUEST_TIMEOUT_MS / 1000}s`
          : `${err instanceof Error ? err.message : String(err)}${causeCode ? ` (${causeCode})` : ''}`;
        if (attempt < MAX_RETRIES) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new ShopifyApiError(lastError || 'Error de red con Shopify.', 'network');
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ShopifyApiError(lastError || 'Error con Shopify.', 'network');
  }
}

/** Extrae un detalle acotado de un 422 sin filtrar el token ni el body crudo. */
async function safeErrorDetail(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { errors?: unknown };
    const e = j.errors;
    if (typeof e === 'string') return e.slice(0, 200);
    if (e && typeof e === 'object') {
      return Object.entries(e as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('; ')
        .slice(0, 200);
    }
  } catch {
    /* respuesta no-JSON: sin detalle */
  }
  return '';
}

function retryAfterMs(res: Response): number {
  const h = res.headers.get('Retry-After');
  const s = h ? Number(h) : 1;
  return (Number.isFinite(s) && s > 0 ? s : 1) * 1000;
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Backoff exponencial: ~1s, 2s, 4s. */
function backoffMs(attempt: number): number {
  return 1000 * 2 ** (attempt - 1);
}
/**
 * Espera (ms) hasta que el leaky-bucket de GraphQL recupere puntos suficientes
 * para la próxima query: (costo pedido − disponible) / tasa de recarga. Acotado
 * a 10s; sin datos de throttle, espera 2s por defecto.
 */
function throttleWaitMs(body: ProductsGqlResponse): number {
  const cost = body.extensions?.cost;
  const ts = cost?.throttleStatus;
  if (ts?.restoreRate && ts.restoreRate > 0) {
    const needed = (cost?.requestedQueryCost ?? 0) - (ts.currentlyAvailable ?? 0);
    if (needed > 0) return Math.min(10_000, Math.ceil((needed / ts.restoreRate) * 1000));
  }
  return 2000;
}
