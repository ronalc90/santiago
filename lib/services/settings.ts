import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_SCORING_RULES, ScoringRules, SETTING_KEYS } from '@/lib/services/scoring';
import { DEFAULT_OPPORTUNITY_RULES, OpportunityRules, SETTING_KEYS_OPPORTUNITY } from '@/lib/services/opportunity-rules';

/** Las reglas son un objeto plano serializable; lo afirmamos para el campo Json de Prisma. */
function toJson(rules: ScoringRules): Prisma.InputJsonValue {
  return rules as unknown as Prisma.InputJsonValue;
}

/**
 * Capa de negocio para leer/escribir las reglas configurables.
 * Si no existen en BD, devuelve los valores por defecto.
 */
export async function getScoringRules(): Promise<ScoringRules> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEYS.SCORING_RULES } });
  if (!row) return DEFAULT_SCORING_RULES;
  // Mezclamos con defaults por si se agregan claves nuevas en el futuro
  return { ...DEFAULT_SCORING_RULES, ...(row.value as Partial<ScoringRules>) };
}

export async function saveScoringRules(rules: ScoringRules): Promise<ScoringRules> {
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.SCORING_RULES },
    create: { key: SETTING_KEYS.SCORING_RULES, value: toJson(rules) },
    update: { value: toJson(rules) },
  });
  return rules;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Merge profundo: combina overrides sobre los defaults, descartando claves desconocidas. */
function deepMerge<T>(defaults: T, partial: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(partial)) {
    return (partial === undefined ? defaults : (partial as T));
  }
  const out: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(partial)) {
    if (key in defaults) out[key] = deepMerge((defaults as Record<string, unknown>)[key], partial[key]);
  }
  return out as T;
}

/**
 * Reglas del Motor de Oportunidad: defaults si no hay fila; si hay, se mezclan
 * en profundidad sobre los defaults (tolera claves nuevas en futuras versiones).
 */
export async function getOpportunityRules(): Promise<OpportunityRules> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEYS_OPPORTUNITY.OPPORTUNITY_RULES } });
  if (!row) return DEFAULT_OPPORTUNITY_RULES;
  return deepMerge(DEFAULT_OPPORTUNITY_RULES, row.value);
}

export async function saveOpportunityRules(rules: OpportunityRules): Promise<OpportunityRules> {
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS_OPPORTUNITY.OPPORTUNITY_RULES },
    create: { key: SETTING_KEYS_OPPORTUNITY.OPPORTUNITY_RULES, value: rules as unknown as Prisma.InputJsonValue },
    update: { value: rules as unknown as Prisma.InputJsonValue },
  });
  return rules;
}
