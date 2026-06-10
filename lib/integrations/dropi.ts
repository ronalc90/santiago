import 'server-only';
import { getEnv } from '@/lib/config/env';

/**
 * Cliente de Dropi (catálogo) para el margen. Gateado por env: sin DROPI_API_TOKEN
 * la feature está DESACTIVADA y `lookupByName` devuelve null sin tocar la red.
 *
 * ⚠️ La key de Dropi es IP-restringida y el shape EXACTO de objects[] aún no está
 * confirmado (pendiente de whitelist de IP). Por eso el parseo es DEFENSIVO
 * (`pick` multi-clave, como lib/ad-sources/apify.ts): cuando llegue la 1ª
 * respuesta real, basta ajustar las claves candidatas en `parseDropiObject`.
 */
const REQUEST_TIMEOUT_MS = 15_000;

export interface DropiLookup {
  cost: number | null;
  stock: number | null;
}

export function isDropiConfigured(): boolean {
  return Boolean(getEnv().DROPI_API_TOKEN);
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(n) && v.trim() !== '') return n;
    }
  }
  return null;
}

/** Mapea un objeto del catálogo de Dropi a { cost, stock } de forma tolerante. */
export function parseDropiObject(obj: unknown): DropiLookup {
  if (typeof obj !== 'object' || obj === null) return { cost: null, stock: null };
  const o = obj as Record<string, unknown>;
  return {
    cost: pickNumber(o, ['cost', 'price', 'supplier_price', 'sale_price', 'costo', 'precio_proveedor', 'precio']),
    stock: pickNumber(o, ['stock', 'quantity', 'available', 'active_product_stock', 'cantidad', 'inventario']),
  };
}

/** Busca el producto en el catálogo de Dropi por nombre. Devuelve null si falla o no hay match. */
export async function dropiLookupByName(name: string): Promise<DropiLookup | null> {
  const env = getEnv();
  if (!env.DROPI_API_TOKEN || !name.trim()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.DROPI_API_BASE}/integrations/products`, {
      method: 'POST',
      headers: { 'dropi-integration-key': env.DROPI_API_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ textToSearch: name.trim(), pageSize: 1 }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { objects?: unknown[] };
    const first = Array.isArray(data.objects) ? data.objects[0] : undefined;
    if (!first) return null;
    return parseDropiObject(first);
  } catch {
    return null; // red/timeout/IP-bloqueada: el margen degrada con elegancia
  } finally {
    clearTimeout(timer);
  }
}
