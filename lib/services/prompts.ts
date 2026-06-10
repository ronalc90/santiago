import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Prompts de IA editables desde Ajustes (sin tocar código). Los valores por
 * defecto viven aquí; las personalizaciones se guardan en la tabla Setting
 * (key = "ai_prompts") como un mapa { promptKey: texto }. `getPrompt` devuelve
 * el override si existe, o el default. Solo se persisten los que difieren del
 * default, para que al cambiar un default en código se propague solo.
 */

export const PROMPT_KEYS = {
  SUGGEST_PRODUCT_SYSTEM: 'suggest_product_system',
  LANDING_COPY_SYSTEM: 'landing_copy_system',
  COMPLIANCE_TIKTOK: 'compliance_tiktok',
} as const;
export type PromptKey = (typeof PROMPT_KEYS)[keyof typeof PROMPT_KEYS];

const SETTING_KEY = 'ai_prompts';

export interface PromptDef {
  key: PromptKey;
  label: string;
  description: string;
  default: string;
}

export const PROMPT_DEFS: PromptDef[] = [
  {
    key: PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM,
    label: 'Sugerencia de producto',
    description: 'Instrucción de sistema para proponer la ficha base de un producto a partir del copy de un anuncio.',
    default: [
      'Eres un experto en e-commerce y dropshipping para mercados de LATAM.',
      'A partir del copy de un anuncio ganador, propones la ficha base de un producto para venderlo.',
      'Responde SIEMPRE en español y SOLO con un objeto JSON válido (sin markdown), con estas claves exactas:',
      '{ "name": string, "description": string, "audience": string, "angle": string }',
    ].join('\n'),
  },
  {
    key: PROMPT_KEYS.LANDING_COPY_SYSTEM,
    label: 'Copy de la landing',
    description: 'Instrucción de sistema para generar el copy de las 9 secciones de la landing.',
    default: [
      'Eres un copywriter experto en landings de venta para e-commerce en LATAM.',
      'Generas el copy de las 9 secciones de una landing de producto.',
      'Responde SIEMPRE en español y SOLO con un objeto JSON válido (sin markdown).',
      'Estructura EXACTA:',
      '{',
      '  "audience": string,',
      '  "description": string,',
      '  "angle": string,',
      '  "sections": [ { "slot": number (1..9), "headline": string, "bullets": string[] } ]',
      '}',
      'Las 9 secciones, en orden, son: 1 hero, 2 precio/oferta, 3 antes/después,',
      '4 modo de uso, 5 beneficios, 6 ficha técnica, 7 garantía, 8 urgencia, 9 testimonios.',
      'Cada sección debe tener un headline corto y de 2 a 4 bullets.',
    ].join('\n'),
  },
  {
    key: PROMPT_KEYS.COMPLIANCE_TIKTOK,
    label: 'Compliance TikTok',
    description: 'Reglas que se añaden al copy cuando el modo "Compliance TikTok" está activo.',
    default: [
      'COMPLIANCE (TikTok): sin afirmaciones médicas, sin mencionar pérdida de peso,',
      'sin promesas absolutas ("cura", "garantizado", "100%"). Mantén los claims suaves',
      'y orientados al estilo de vida.',
    ].join(' '),
  },
];

const DEFAULTS: Record<string, string> = Object.fromEntries(PROMPT_DEFS.map((p) => [p.key, p.default]));

/**
 * Combina los defaults con los overrides guardados (función pura, testeable):
 * solo aplica overrides de claves conocidas y con texto no vacío.
 */
export function effectivePrompts(overrides: Record<string, unknown> | null | undefined): Record<PromptKey, string> {
  const out: Record<string, string> = { ...DEFAULTS };
  if (overrides) {
    for (const def of PROMPT_DEFS) {
      const v = overrides[def.key];
      if (typeof v === 'string' && v.trim()) out[def.key] = v;
    }
  }
  return out as Record<PromptKey, string>;
}

/** Mapa efectivo (override o default) de todos los prompts. */
export async function getAllPrompts(): Promise<Record<PromptKey, string>> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  return effectivePrompts(row?.value as Record<string, unknown> | undefined);
}

/** Texto efectivo de un prompt concreto. */
export async function getPrompt(key: PromptKey): Promise<string> {
  return (await getAllPrompts())[key];
}

/** Guarda los overrides (solo los que difieren del default y no están vacíos). */
export async function savePrompts(overrides: Record<string, string>): Promise<Record<PromptKey, string>> {
  const clean: Record<string, string> = {};
  for (const def of PROMPT_DEFS) {
    const v = overrides[def.key];
    if (typeof v === 'string' && v.trim() && v.trim() !== def.default.trim()) clean[def.key] = v.trim();
  }
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: clean as Prisma.InputJsonValue },
    update: { value: clean as Prisma.InputJsonValue },
  });
  return effectivePrompts(clean);
}
