import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isShopifyConfigured, ShopifyClient, ShopifyCostRow } from '@/lib/shopify/client';
import { computeAndPersistOpportunity } from '@/lib/services/opportunity-engine';

/**
 * Sincroniza el "costo por artículo" desde Shopify hacia los productos de WinSpy.
 * Dropi NO da API a terceros: el costo llega a Shopify por la integración oficial
 * Dropi→Shopify y aquí se LEE de Shopify (inventoryItem.unitCost).
 *
 * Mapea cada costo al producto por el vínculo de publicación (landing.shopifyProductId)
 * y, si no hay, por título. Persiste shopifyUnitCost + costUpdatedAt, recalcula la
 * oportunidad de los productos con costo nuevo, y guarda un resumen del último sync.
 */
export interface CostSyncResult {
  configured: boolean;
  missingScope: boolean; // falta read_inventory en la app de Shopify
  total: number; // productos de WinSpy
  matched: number; // emparejados con un producto de Shopify
  updated: number; // costo actualizado
  withoutCost: number; // emparejados pero sin unitCost cargado en Shopify
  ambiguousTitles: number; // títulos de Shopify duplicados (no se emparejan por título)
  at: string; // ISO
}

const SETTING_KEY = 'cost_sync_status';
// Lotes acotados en paralelo para evitar N+1 secuencial (writes + recompute con
// consulta a ML) sin saturar la BD ni las cuotas externas.
const CHUNK = 25;

async function saveStatus(result: CostSyncResult): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: result as unknown as Prisma.InputJsonValue },
    update: { value: result as unknown as Prisma.InputJsonValue },
  });
}

/** Último resumen de sincronización de costos (para la UI). */
export async function getCostSyncStatus(): Promise<CostSyncResult | null> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  return row ? (row.value as unknown as CostSyncResult) : null;
}

/** Normaliza un título para emparejar: sin acentos, minúsculas, espacios colapsados. */
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Empareja un producto de WinSpy con su fila de costo de Shopify (pura, testeable):
 * (a) por el vínculo de publicación (landing.shopifyProductId); (b) por título, salvo
 * que el título sea ambiguo (varios productos de Shopify con el mismo nombre), en cuyo
 * caso NO se empareja a ciegas para no asignar un costo equivocado.
 */
export function matchShopifyCost(
  product: { name: string; landings: { shopifyProductId: string | null }[] },
  byShopifyId: Map<string, ShopifyCostRow>,
  byTitle: Map<string, ShopifyCostRow>,
  ambiguousTitles?: Set<string>,
): ShopifyCostRow | undefined {
  for (const l of product.landings) {
    if (l.shopifyProductId && byShopifyId.has(l.shopifyProductId)) return byShopifyId.get(l.shopifyProductId);
  }
  const key = normalizeTitle(product.name);
  if (ambiguousTitles?.has(key)) return undefined;
  return byTitle.get(key);
}

/** Ejecuta `fn` sobre `items` en lotes paralelos de tamaño `CHUNK`. */
async function inChunks<T>(items: T[], fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    await Promise.all(items.slice(i, i + CHUNK).map(fn));
  }
}

export async function syncShopifyCosts(): Promise<CostSyncResult> {
  const base: CostSyncResult = {
    configured: isShopifyConfigured(),
    missingScope: false,
    total: 0,
    matched: 0,
    updated: 0,
    withoutCost: 0,
    ambiguousTitles: 0,
    at: new Date().toISOString(),
  };
  if (!base.configured) {
    await saveStatus(base);
    return base;
  }

  const { rows, missingInventoryScope } = await new ShopifyClient().fetchAllProductCosts();
  if (missingInventoryScope) {
    const r = { ...base, missingScope: true };
    await saveStatus(r);
    return r;
  }

  const byShopifyId = new Map<string, ShopifyCostRow>();
  const byTitle = new Map<string, ShopifyCostRow>();
  const ambiguousTitles = new Set<string>();
  for (const row of rows) {
    if (row.shopifyProductId) byShopifyId.set(row.shopifyProductId, row);
    if (row.title) {
      const key = normalizeTitle(row.title);
      // Colisión de títulos en Shopify: no se puede desambiguar por nombre → ambiguo.
      if (byTitle.has(key)) ambiguousTitles.add(key);
      else byTitle.set(key, row);
    }
  }

  const products = await prisma.product.findMany({ include: { landings: { select: { shopifyProductId: true } } } });
  const now = new Date();
  let matched = 0;
  let withoutCost = 0;
  const toUpdate: { id: string; cost: number }[] = [];

  for (const p of products) {
    const row = matchShopifyCost(p, byShopifyId, byTitle, ambiguousTitles);
    if (!row) continue;
    matched += 1;
    if (row.unitCost == null) {
      withoutCost += 1;
      continue;
    }
    // Solo escribir si el costo CAMBIÓ: así costUpdatedAt refleja la última vez que
    // cambió el valor (no cada corrida) y se evitan writes inútiles.
    if (p.shopifyUnitCost !== row.unitCost) toUpdate.push({ id: p.id, cost: row.unitCost });
  }

  await inChunks(toUpdate, (u) =>
    prisma.product.update({ where: { id: u.id }, data: { shopifyUnitCost: u.cost, costUpdatedAt: now } }),
  );
  // Recalcular la oportunidad de los productos cuyo costo cambió (no bloquea ante fallo).
  await inChunks(toUpdate, (u) => computeAndPersistOpportunity(u.id).catch(() => {}));

  const result: CostSyncResult = {
    ...base,
    total: products.length,
    matched,
    updated: toUpdate.length,
    withoutCost,
    ambiguousTitles: ambiguousTitles.size,
  };
  await saveStatus(result);
  return result;
}
