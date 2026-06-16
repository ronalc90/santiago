import type { OpportunityBand, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config/env';
import { getOpportunityRules } from '@/lib/services/settings';
import { computeOpportunity } from '@/lib/services/opportunity';
import { normalizeName } from '@/lib/discovery/normalize';
import { candidateToSignals } from '@/lib/discovery/score';
import { DiscoveryCandidate, DiscoveryParams, DiscoverySource } from '@/lib/discovery/types';
import { mockSource } from '@/lib/discovery/mock';
import { mercadoLibreSource } from '@/lib/discovery/mercadolibre';

/**
 * Orquestador de descubrimiento: corre las fuentes ACTIVAS, deduplica el mismo
 * producto entre fuentes/países (por nombre normalizado), cruza con Colombia,
 * puntúa con el motor 4×25 y persiste OpportunityCandidate (idempotente: upsert
 * por nombre normalizado). Si una fuente falla, las demás siguen.
 */
const STATUS_KEY = 'discovery_status';

export interface DiscoveryResult {
  mock: boolean;
  sources: string[]; // fuentes que corrieron
  found: number; // candidatos crudos (antes de dedupe)
  candidates: number; // únicos tras dedupe
  upserted: number;
  warning?: string; // aviso de configuración (p. ej. sin keywords)
  at: string; // ISO
}

const csv = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);

/** Fuentes activas: en modo mock, solo la de prueba; si no, las gratis activas. */
export function getActiveSources(): DiscoverySource[] {
  if (getEnv().DISCOVERY_MOCK) return [mockSource];
  // Las de pago (Meta/TikTok/Apify) y Trends se sumarán aquí en fase 2, gateadas.
  const all: DiscoverySource[] = [mercadoLibreSource];
  return all.filter((s) => s.estaActiva());
}

function discoveryParams(): DiscoveryParams {
  const env = getEnv();
  const countries = csv(env.DISCOVERY_COUNTRIES);
  const keywords = csv(env.DISCOVERY_KEYWORDS).length ? csv(env.DISCOVERY_KEYWORDS) : csv(env.AD_SOURCE_KEYWORDS);
  return {
    countries: countries.length ? countries : ['MCO'],
    keywords,
    limit: 10,
  };
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

export async function getDiscoveryStatus(): Promise<DiscoveryResult | null> {
  const row = await prisma.setting.findUnique({ where: { key: STATUS_KEY } });
  return row ? (row.value as unknown as DiscoveryResult) : null;
}

export async function runDiscovery(): Promise<DiscoveryResult> {
  const at = new Date().toISOString();
  const params = discoveryParams();
  const sources = getActiveSources();

  // Aviso si no hay nada que buscar (no es un 0-candidatos "exitoso" engañoso).
  let warning: string | undefined;
  if (!getEnv().DISCOVERY_MOCK && params.keywords.length === 0) {
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

  // Dedupe por nombre normalizado: acumula países, fuentes y métricas.
  const byKey = new Map<string, Agg>();
  for (const c of raw) {
    const key = normalizeName(c.name);
    if (!key) continue;
    const a: Agg = byKey.get(key) ?? {
      name: c.name,
      category: c.category ?? null,
      countries: new Set(),
      sources: new Set(),
      interest: null,
      salesCount: null,
      daysActive: null,
      listingsByCountry: new Map(),
      creatives: [],
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
    for (const cr of c.creatives ?? []) {
      a.creatives.push({ url: cr.url, type: cr.type, country: cr.country ?? iso, source: c.source });
    }
    if (!a.category && c.category) a.category = c.category;
    byKey.set(key, a);
  }

  const rules = await getOpportunityRules();
  let upserted = 0;

  for (const [key, a] of byKey) {
    const countries = Array.from(a.countries);
    const enCO = a.countries.has('CO');
    const saturationCO = a.listingsByCountry.get('CO') ?? null;
    const listingsCount = a.listingsByCountry.size
      ? Math.max(...Array.from(a.listingsByCountry.values()))
      : null;
    const numImages = a.creatives.filter((x) => x.type === 'image').length;
    const numVideos = a.creatives.filter((x) => x.type === 'video').length;

    const result = computeOpportunity(
      candidateToSignals({ countries, interest: a.interest, salesCount: a.salesCount, listingsCount, daysActive: a.daysActive, enCO, saturationCO, numImages, numVideos }),
      rules,
    );

    const existing = await prisma.opportunityCandidate.findUnique({
      where: { normalizedName: key },
      select: { id: true, countries: true, sources: true, creatives: { select: { url: true } } },
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
      // Creativos: añadir solo los nuevos (por url), SIN borrar los existentes, para
      // no perder su storageKey en R2. Acotado a 12 en total.
      const have = new Set(existing.creatives.map((cr) => cr.url));
      const nuevos = a.creatives.filter((cr) => !have.has(cr.url)).slice(0, Math.max(0, 12 - have.size));
      if (nuevos.length) {
        await prisma.opportunityCreative.createMany({
          data: nuevos.map((cr) => ({ candidateId: existing.id, url: cr.url, type: cr.type, country: cr.country, source: cr.source })),
        });
      }
    } else {
      await prisma.opportunityCandidate.create({
        data: {
          normalizedName: key,
          ...data,
          creatives: a.creatives.length
            ? { create: a.creatives.slice(0, 12).map((cr) => ({ url: cr.url, type: cr.type, country: cr.country, source: cr.source })) }
            : undefined,
        },
      });
    }
    upserted += 1;
  }

  const res: DiscoveryResult = { mock: getEnv().DISCOVERY_MOCK, sources: sources.map((s) => s.id), found: raw.length, candidates: byKey.size, upserted, warning, at };
  await prisma.setting.upsert({
    where: { key: STATUS_KEY },
    create: { key: STATUS_KEY, value: res as unknown as Prisma.InputJsonValue },
    update: { value: res as unknown as Prisma.InputJsonValue },
  });
  return res;
}
