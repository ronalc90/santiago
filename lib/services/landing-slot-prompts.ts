import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { LANDING_SLOTS } from '@/lib/services/landing-spec';

/**
 * Prompt (intención) editable POR IMAGEN de la landing (las 9, independientes).
 * El default es el `intent` de cada slot (landing-spec). Los overrides se guardan
 * en Setting (key "landing_slot_intents") como { "1": texto, … }; solo se persiste
 * lo que difiere del default. Al generar, buildImagePrompt usa la intención efectiva.
 */
const KEY = 'landing_slot_intents';

export interface SlotPromptDef {
  slot: number;
  type: string;
  title: string;
  intent: string; // efectivo (override o default)
  default: string;
}

/** Intención efectiva por slot (override o default). */
export async function getSlotIntents(): Promise<Record<number, string>> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const saved = (row?.value ?? {}) as Record<string, string>;
  const out: Record<number, string> = {};
  for (const s of LANDING_SLOTS) {
    const v = saved[String(s.slot)];
    out[s.slot] = typeof v === 'string' && v.trim() ? v.trim() : s.intent;
  }
  return out;
}

/** Para la UI: las 9 con su título, intención efectiva y default. */
export async function getSlotPromptsForUI(): Promise<SlotPromptDef[]> {
  const eff = await getSlotIntents();
  return LANDING_SLOTS.map((s) => ({ slot: s.slot, type: s.type, title: s.title, intent: eff[s.slot], default: s.intent }));
}

/** Guarda los overrides (solo los que difieren del default). */
export async function saveSlotIntents(intents: Record<number, string>): Promise<void> {
  const clean: Record<string, string> = {};
  for (const s of LANDING_SLOTS) {
    const v = intents[s.slot]?.trim();
    if (v && v !== s.intent) clean[String(s.slot)] = v;
  }
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: clean as Prisma.InputJsonValue },
    update: { value: clean as Prisma.InputJsonValue },
  });
}
