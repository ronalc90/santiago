import type { OpportunityBand, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config/env';
import { getOpportunityRules } from '@/lib/services/settings';
import { computeOpportunity } from '@/lib/services/opportunity';
import { persistCreative } from '@/lib/services/creative';
import { getDiscoveryConfig, DiscoveryConfig } from '@/lib/services/discovery-config';
import { matchCandidatesToDropi, syncDropiCatalogFromShopify } from '@/lib/services/dropi-catalog';
import { isShopifyConfigured } from '@/lib/shopify/client';
import { normalizeName } from '@/lib/discovery/normalize';
import { candidateToSignals } from '@/lib/discovery/score';
import { embedTexts, cosine } from '@/lib/discovery/embeddings';
import { DiscoveryCandidate, DiscoveryParams, DiscoverySource } from '@/lib/discovery/types';
import { mockSource } from '@/lib/discovery/mock';
import { mercadoLibreSource } from '@/lib/discovery/mercadolibre';
import { googleTrendsSource } from '@/lib/discovery/google-trends';
import { metaApifySource } from '@/lib/discovery/meta-apify';
import { tiktokApifySource } from '@/lib/discovery/tiktok-apify';

/**
 * Orquestador de descubrimiento: corre las fuentes ACTIVAS (según config), deduplica
 * (nombre normalizado + opcional embeddings), cruza con Colombia y Dropi, puntúa con
 * el motor 4×25 y persiste OpportunityCandidate idempotente. Si una fuente falla, las
 * demás siguen. Descarga los creativos a R2 (galería).
 */
const STATUS_KEY = 'discovery_status';
const MAX_CREATIVES = 6;

export interface DiscoveryResult {
  mock: boolean;
  sources: string[];
  found: number; // candidatos crudos (antes de dedupe)
  candidates: number; // únicos tras dedupe
  upserted: number;
  dropiMatched: number;
  embeddingsFailed?: boolean; // dedupe por embeddings activo pero degradó (sin key/timeout)
  warning?: string;
  at: string; // ISO
}

interface Agg {
  name: string;
  category: string | null;
  countries: Set<string>;
  sources: Set<string>;
  interest: number | null;
  salesCount: number | null;
  daysActive: number | null;
  listingsByCountry: Map<string, number>;
  creatives: { url: string; type: string; country: string | null; source: string }[];
}

const maxN = (a: number | null, b: number | null | undefined): number | null => {
  if (b == null) return a;
  return a == null ? b : Math.max(a, b);
};

/** Fuentes a correr según la config (mock → solo prueba). estaActiva = disponibilidad de env. */
function sourcesFromConfig(cfg: DiscoveryConfig, mock: boolean): DiscoverySource[] {
  if (mock) return [mockSource];
  const list: DiscoverySource[] = [];
  if (mercadoLibreSource.estaActiva()) list.push(mercadoLibreSource); // gratis, núcleo
  if (cfg.sources.trends && googleTrendsSource.estaActiva()) list.push(googleTrendsSource);
  if (cfg.sources.meta && metaApifySource.estaActiva()) list.push(metaApifySource);
  if (cfg.sources.tiktok && tiktokApifySource.estaActiva()) list.push(tiktokApifySource);
  return list;
}

/** Fuentes activas (para el gate del cron en el worker). */
export async function getActiveSources(): Promise<DiscoverySource[]> {
  return sourcesFromConfig(await getDiscoveryConfig(), getEnv().DISCOVERY_MOCK);
}

export async function getDiscoveryStatus(): Promise<DiscoveryResult | null> {
  const row = await prisma.setting.findUnique({ where: { key: STATUS_KEY } });
  return row ? (row.value as unknown as DiscoveryResult) : null;
}

function mergeAgg(into: Agg, from: Agg): void {
  from.countries.forEach((c) => into.countries.add(c));
  from.sources.forEach((s) => into.sources.add(s));
  into.interest = maxN(into.interest, from.interest);
  into.salesCount = maxN(into.salesCount, from.salesCount);
  into.daysActive = maxN(into.daysActive, from.daysActive);
  from.listingsByCountry.forEach((v, c) => into.listingsByCountry.set(c, Math.max(into.listingsByCountry.get(c) ?? 0, v)));
  into.creatives.push(...from.creatives);
  if (!into.category && from.category) into.category = from.category;
}

/** 2ª pasada de dedupe por embeddings: fusiona casi-idénticos (coseno ≥ 0.9). false = degradó. */
async function mergeByEmbeddings(byKey: Map<string, Agg>): Promise<boolean> {
  const keys = Array.from(byKey.keys());
  if (keys.length < 2) return true;
  const emb = await embedTexts(keys.map((k) => byKey.get(k)!.name));
  if (!emb) return false;
  const kept: { key: string; vec: number[] }[] = [];
  keys.forEach((k, i) => {
    const match = kept.find((p) => cosine(p.vec, emb[i]) >= 0.9);
    if (match) {
      mergeAgg(byKey.get(match.key)!, byKey.get(k)!);
      byKey.delete(k);
    } else {
      kept.push({ key: k, vec: emb[i] });
    }
  });
  return true;
}

const isHttpUrl = (u: string): boolean => /^https?:\/\//i.test(u);
type ExistingCreative = { id: string; url: string; storageKey: string | null };

/**
 * Sincroniza la galería de un candidato: reintenta subir a R2 los creativos que
 * quedaron sin storageKey y añade los nuevos (descargándolos a R2). Descarta URLs
 * no http(s) para no dejar filas rotas. Preserva los ya guardados (idempotente).
 */
async function syncCreatives(candidateId: string, incoming: Agg['creatives'], existing: ExistingCreative[]): Promise<void> {
  const downloadKind = (t: string): 'image' | 'video' => (t === 'video' ? 'video' : 'image');

  // 1) Reintentar los que se insertaron con la URL original (sin R2).
  for (const row of existing) {
    if (row.storageKey || !isHttpUrl(row.url)) continue;
    const kind = downloadKind(incoming.find((c) => c.url === row.url)?.type ?? 'image');
    try {
      const stored = await persistCreative(`discovery/${candidateId}`, row.url, kind);
      await prisma.opportunityCreative.update({ where: { id: row.id }, data: { url: stored.url, storageKey: stored.key } });
    } catch {
      /* la URL original ya caducó; se queda como está */
    }
  }

  // 2) Añadir los nuevos (por url), descartando URLs inválidas.
  const haveUrls = new Set(existing.map((r) => r.url));
  const nuevos = incoming.filter((cr) => !haveUrls.has(cr.url) && isHttpUrl(cr.url)).slice(0, Math.max(0, MAX_CREATIVES - existing.length));
  for (const cr of nuevos) {
    let url = cr.url;
    let storageKey: string | null = null;
    try {
      const stored = await persistCreative(`discovery/${candidateId}`, cr.url, downloadKind(cr.type));
      url = stored.url;
      storageKey = stored.key;
    } catch {
      /* la URL original puede haber caducado; se guarda tal cual, se reintentará */
    }
    await prisma.opportunityCreative.create({
      data: { candidateId, url, type: cr.type, country: cr.country, source: cr.source, storageKey },
    });
  }
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  const at = new Date().toISOString();
  const mock = getEnv().DISCOVERY_MOCK;
  const cfg = await getDiscoveryConfig();
  const params: DiscoveryParams = { countries: cfg.countries, keywords: cfg.keywords, limit: 12 };
  const sources = sourcesFromConfig(cfg, mock);

  let warning: string | undefined;
  if (!mock && params.keywords.length === 0) {
    warning = 'Sin keywords: define DISCOVERY_KEYWORDS o AD_SOURCE_KEYWORDS. No se buscó nada.';
    console.warn(`[discovery] ${warning}`);
  }

  const raw: DiscoveryCandidate[] = [];
  for (const s of sources) {
    try {
      raw.push(...(await s.buscar(params)));
    } catch (e) {
      console.error(`[discovery:${s.id}]`, e instanceof Error ? e.message : e);
    }
  }

  // 1ª dedupe: nombre normalizado.
  const byKey = new Map<string, Agg>();
  for (const c of raw) {
    const key = normalizeName(c.name);
    if (!key) continue;
    const a: Agg = byKey.get(key) ?? {
      name: c.name, category: c.category ?? null, countries: new Set(), sources: new Set(),
      interest: null, salesCount: null, daysActive: null, listingsByCountry: new Map(), creatives: [],
    };
    const iso = c.country.toUpperCase();
    a.countries.add(iso);
    a.sources.add(c.source);
    a.interest = maxN(a.interest, c.metrics?.interest);
    a.salesCount = maxN(a.salesCount, c.metrics?.salesCount);
    a.daysActive = maxN(a.daysActive, c.metrics?.daysActive);
    if (c.metrics?.listingsCount != null) {
      a.listingsByCountry.set(iso, Math.max(a.listingsByCountry.get(iso) ?? 0, c.metrics.listingsCount));
    }
    for (const cr of c.creatives ?? []) a.creatives.push({ url: cr.url, type: cr.type, country: cr.country ?? iso, source: c.source });
    if (!a.category && c.category) a.category = c.category;
    byKey.set(key, a);
  }

  // 2ª dedupe opcional por embeddings (OpenAI).
  let embeddingsFailed = false;
  if (cfg.sources.embeddings) {
    const ok = await mergeByEmbeddings(byKey).catch((e) => {
      console.error('[discovery:embeddings]', e instanceof Error ? e.message : e);
      return false;
    });
    embeddingsFailed = !ok;
  }

  const rules = await getOpportunityRules();
  let upserted = 0;

  for (const [key, a] of byKey) {
    const countries = Array.from(a.countries);
    const enCO = a.countries.has('CO');
    const saturationCO = a.listingsByCountry.get('CO') ?? null;
    const listingsCount = a.listingsByCountry.size ? Math.max(...Array.from(a.listingsByCountry.values())) : null;
    const numImages = a.creatives.filter((x) => x.type === 'image').length;
    const numVideos = a.creatives.filter((x) => x.type === 'video').length;

    const result = computeOpportunity(
      candidateToSignals({ countries, interest: a.interest, salesCount: a.salesCount, listingsCount, daysActive: a.daysActive, enCO, saturationCO, numImages, numVideos }),
      rules,
    );

    const existing = await prisma.opportunityCandidate.findUnique({
      where: { normalizedName: key },
      select: { id: true, countries: true, sources: true, creatives: { select: { id: true, url: true, storageKey: true } } },
    });
    const union = (prev: string[] | undefined, next: string[]) => Array.from(new Set([...(prev ?? []), ...next]));
    const data = {
      name: a.name,
      category: a.category,
      countries: union(existing?.countries, countries),
      sources: union(existing?.sources, Array.from(a.sources)),
      interest: a.interest,
      salesCount: a.salesCount,
      listingsCount,
      daysActive: a.daysActive,
      enCO,
      saturationCO,
      score4x25: result.score,
      scoreBand: result.band as OpportunityBand,
      breakdown: { dimensions: result.dimensions, coverage: result.coverage, confidence: result.confidence } as unknown as Prisma.InputJsonValue,
    };

    if (existing) {
      await prisma.opportunityCandidate.update({ where: { id: existing.id }, data });
      await syncCreatives(existing.id, a.creatives, existing.creatives);
    } else {
      const created = await prisma.opportunityCandidate.create({ data: { normalizedName: key, ...data } });
      await syncCreatives(created.id, a.creatives, []);
    }
    upserted += 1;
  }

  // Cruce con el catálogo Dropi. Si Shopify está configurado, refresca primero el
  // catálogo DESDE Shopify (que Dropi alimenta) y de paso cruza —así «Con Dropi»
  // se llena solo en cada búsqueda, sin tocar nada. Si no, solo cruza contra lo
  // ya cargado (CSV). Nunca debe tumbar la discovery si Shopify falla.
  const dropiMatched = isShopifyConfigured()
    ? (await syncDropiCatalogFromShopify().catch(() => ({ matched: 0 }))).matched
    : await matchCandidatesToDropi().catch(() => 0);

  const res: DiscoveryResult = { mock, sources: sources.map((s) => s.id), found: raw.length, candidates: byKey.size, upserted, dropiMatched, embeddingsFailed: embeddingsFailed || undefined, warning, at };
  await prisma.setting.upsert({
    where: { key: STATUS_KEY },
    create: { key: STATUS_KEY, value: res as unknown as Prisma.InputJsonValue },
    update: { value: res as unknown as Prisma.InputJsonValue },
  });
  return res;
}
