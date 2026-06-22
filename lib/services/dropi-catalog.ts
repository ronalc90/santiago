import { DropiAvailability } from '@prisma/client';
import { prisma } from '@/lib/db';
import { normalizeName } from '@/lib/discovery/normalize';
import { fetchDropiProducts } from '@/lib/integrations/dropi';

/**
 * Catálogo de Dropi: por API de Integraciones (automático, `syncDropiCatalogFromApi`)
 * o por CSV (`importDropiCsv`, fallback). Llena DropiCatalogItem y cruza los
 * candidatos por nombre (exacto normalizado y, si no, fuzzy por solapamiento de
 * tokens) para marcar su dropiStatus.
 */

/** Parser CSV tolerante (cabecera + comillas dobles básicas). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (lines.length < 2) return [];
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

const pick = (row: Record<string, string>, ...keys: string[]): string => {
  for (const k of keys) if (row[k]?.trim()) return row[k].trim();
  return '';
};
const toInt = (s: string): number | null => {
  const n = Number(String(s).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

export interface DropiImportResult {
  received: number;
  upserted: number;
}

export async function importDropiCsv(csv: string): Promise<DropiImportResult> {
  const rows = parseCsv(csv);
  let upserted = 0;
  for (const r of rows) {
    const name = pick(r, 'name', 'nombre', 'producto', 'title', 'titulo');
    if (!name) continue;
    const ok = await upsertCatalogItem({
      name,
      sku: pick(r, 'sku', 'codigo', 'code') || null,
      category: pick(r, 'category', 'categoria') || null,
      cost: toInt(pick(r, 'cost', 'costo', 'price', 'precio')),
      stock: toInt(pick(r, 'stock', 'inventario', 'existencias')),
      imageUrl: pick(r, 'image', 'imagen', 'imageurl', 'image_url', 'foto') || null,
    });
    if (ok) upserted += 1;
  }
  return { received: rows.length, upserted };
}

/** Upsert de un producto del catálogo Dropi en DropiCatalogItem. */
async function upsertCatalogItem(p: {
  name: string;
  sku: string | null;
  category: string | null;
  cost: number | null;
  stock: number | null;
  imageUrl: string | null;
}): Promise<boolean> {
  const key = normalizeName(p.name);
  if (!key) return false;
  const data = { name: p.name, sku: p.sku, category: p.category, cost: p.cost, stock: p.stock, imageUrl: p.imageUrl };
  await prisma.dropiCatalogItem.upsert({ where: { normalizedName: key }, create: { normalizedName: key, ...data }, update: data });
  return true;
}

/**
 * Sincroniza el catálogo Dropi desde su API de Integraciones (automático) y
 * re-cruza los candidatos. Requiere credenciales (ver isDropiApiConfigured).
 */
export async function syncDropiCatalogFromApi(): Promise<DropiImportResult & { matched: number }> {
  const products = await fetchDropiProducts();
  let upserted = 0;
  for (const p of products) if (await upsertCatalogItem(p)) upserted += 1;
  const matched = await matchCandidatesToDropi().catch(() => 0);
  return { received: products.length, upserted, matched };
}

/** Solapamiento de tokens (Jaccard) entre dos nombres normalizados. */
function tokenOverlap(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / new Set([...sa, ...sb]).size;
}

/**
 * Cruza TODOS los candidatos contra el catálogo Dropi: match exacto por nombre
 * normalizado o fuzzy (Jaccard ≥ 0.6). Marca dropiStatus + dropiRef. Devuelve
 * cuántos quedaron emparejados. No hace nada si el catálogo está vacío.
 */
export async function matchCandidatesToDropi(): Promise<number> {
  const items = await prisma.dropiCatalogItem.findMany({ select: { normalizedName: true, sku: true } });
  if (!items.length) return 0;
  const byName = new Map(items.map((i) => [i.normalizedName, i]));
  const candidates = await prisma.opportunityCandidate.findMany({ select: { id: true, normalizedName: true } });

  // Resuelve el match en memoria y agrupa por (status, ref) para emitir pocos
  // updateMany en vez de N updates secuenciales (que saturarían el pool de Prisma).
  const noMatch: string[] = [];
  const byRef = new Map<string, string[]>(); // sku (o '∅') → ids con match
  let matched = 0;
  for (const c of candidates) {
    let item = byName.get(c.normalizedName) ?? null;
    if (!item) {
      let best = 0;
      for (const it of items) {
        const score = tokenOverlap(c.normalizedName, it.normalizedName);
        if (score > best && score >= 0.6) { best = score; item = it; }
      }
    }
    if (item) {
      const ref = item.sku ?? '∅';
      (byRef.get(ref) ?? byRef.set(ref, []).get(ref)!).push(c.id);
      matched += 1;
    } else {
      noMatch.push(c.id);
    }
  }

  if (noMatch.length) {
    await prisma.opportunityCandidate.updateMany({ where: { id: { in: noMatch } }, data: { dropiStatus: DropiAvailability.DESCONOCIDO, dropiRef: null } });
  }
  for (const [ref, ids] of byRef) {
    await prisma.opportunityCandidate.updateMany({ where: { id: { in: ids } }, data: { dropiStatus: DropiAvailability.DISPONIBLE, dropiRef: ref === '∅' ? null : ref } });
  }
  return matched;
}
