import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { DEFAULT_SCORING_RULES, ScoringRules, SETTING_KEYS } from '@/lib/services/scoring';

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
