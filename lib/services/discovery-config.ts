import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config/env';

/**
 * Configuración del descubrimiento: switches por fuente + países/keywords. Vive en
 * la tabla Setting (editable desde Ajustes) con los valores de env como defaults.
 * Así los switches de la UI funcionan en caliente sin redeploy.
 */
const KEY = 'discovery_config';

export interface DiscoveryConfig {
  sources: { trends: boolean; meta: boolean; tiktok: boolean; embeddings: boolean };
  countries: string[]; // sites de ML (MCO, MLM…)
  keywords: string[];
}

const csv = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);

function envDefaults(): DiscoveryConfig {
  const env = getEnv();
  const countries = csv(env.DISCOVERY_COUNTRIES);
  const keywords = csv(env.DISCOVERY_KEYWORDS).length ? csv(env.DISCOVERY_KEYWORDS) : csv(env.AD_SOURCE_KEYWORDS);
  return {
    sources: {
      trends: env.GOOGLE_TRENDS_ENABLED,
      meta: env.META_DISCOVERY === 'on',
      tiktok: env.TIKTOK_DISCOVERY === 'on',
      embeddings: false,
    },
    countries: countries.length ? countries : ['MCO'],
    keywords,
  };
}

export async function getDiscoveryConfig(): Promise<DiscoveryConfig> {
  const def = envDefaults();
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return def;
  const saved = (row.value ?? {}) as Partial<DiscoveryConfig>;
  return {
    sources: { ...def.sources, ...(saved.sources ?? {}) },
    countries: saved.countries?.length ? saved.countries : def.countries,
    keywords: saved.keywords?.length ? saved.keywords : def.keywords,
  };
}

export async function saveDiscoveryConfig(cfg: DiscoveryConfig): Promise<DiscoveryConfig> {
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: cfg as unknown as Prisma.InputJsonValue },
    update: { value: cfg as unknown as Prisma.InputJsonValue },
  });
  return cfg;
}
