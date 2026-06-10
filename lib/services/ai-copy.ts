import { getTextGenerator } from '@/lib/text';
import { LandingSectionCopy } from '@/lib/services/landing-spec';
import { getPrompt, PROMPT_KEYS } from '@/lib/services/prompts';

/**
 * Servicio de copy con IA (texto). Usa el generador configurado por TEXT_PROVIDER
 * (mock | openai | gemini) y devuelve datos ya parseados y normalizados.
 *
 * Toda la salida del modelo es en español. El parseo es tolerante: acepta JSON
 * envuelto en ```json``` o rodeado de texto, y falla con mensajes claros.
 */

export type { LandingSectionCopy } from '@/lib/services/landing-spec';

/** Sugerencia de producto a partir del copy de un anuncio ganador. */
export interface ProductSuggestion {
  name: string;
  description: string;
  audience: string;
  angle: string;
}

/** Copy completo de una landing: campos afinados + las 9 secciones. */
export interface LandingCopy {
  audience: string;
  description: string;
  angle: string;
  sections: LandingSectionCopy[];
}

/** Datos de entrada (de referencia) para generar el copy de la landing. */
export interface LandingCopyInputs {
  productName: string;
  country: string;
  audience?: string;
  description?: string;
  angle?: string;
  offerType?: string;
}

/**
 * Extrae y parsea el JSON devuelto por un modelo de lenguaje de forma robusta.
 * Quita cercas de código (```json ... ```), recorta texto sobrante alrededor del
 * objeto y lanza un error claro si no hay JSON interpretable.
 */
export function parseJsonLoose<T>(raw: string): T {
  if (!raw || !raw.trim()) {
    throw new Error('La IA devolvió una respuesta vacía.');
  }
  let text = raw.trim();

  // Quita cercas de código: ```json ... ``` o ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Si hay texto antes/después del objeto, recorta al primer { y último }.
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('No se pudo interpretar el JSON devuelto por la IA.');
  }
}

/**
 * Normaliza las secciones devueltas por el modelo: fuerza tipos, descarta slots
 * inválidos (fuera de 1..9), recorta blancos y ordena por slot.
 */
export function normalizeSections(raw: unknown): LandingSectionCopy[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  return raw
    .map((s) => {
      const item = s as { slot?: unknown; headline?: unknown; bullets?: unknown };
      const slot = Number(item.slot);
      const bullets = Array.isArray(item.bullets)
        ? item.bullets.map((b) => String(b).trim()).filter(Boolean)
        : [];
      return { slot, headline: String(item.headline ?? '').trim(), bullets };
    })
    .filter((s) => {
      if (!Number.isInteger(s.slot) || s.slot < 1 || s.slot > 9) return false;
      if (seen.has(s.slot)) return false;
      seen.add(s.slot);
      return true;
    })
    .sort((a, b) => a.slot - b.slot);
}

/**
 * Sugiere la ficha base de un producto a partir del copy de un anuncio.
 * Devuelve { name, description, audience, angle } en español.
 */
export async function suggestProduct(adCopy: string, country: string): Promise<ProductSuggestion> {
  const generator = getTextGenerator();

  const system = await getPrompt(PROMPT_KEYS.SUGGEST_PRODUCT_SYSTEM);

  const user = [
    `País/mercado: ${country}`,
    'Copy del anuncio:',
    '"""',
    adCopy.trim() || '(sin copy disponible)',
    '"""',
    'Devuelve:',
    '- name: nombre comercial corto y atractivo del producto.',
    '- description: 2-3 frases con el producto y su beneficio principal.',
    '- audience: público objetivo concreto.',
    '- angle: ángulo de venta principal.',
  ].join('\n');

  const raw = await generator.complete(system, user, true);
  const parsed = parseJsonLoose<Partial<ProductSuggestion>>(raw);

  return {
    name: String(parsed.name ?? '').trim(),
    description: String(parsed.description ?? '').trim(),
    audience: String(parsed.audience ?? '').trim(),
    angle: String(parsed.angle ?? '').trim(),
  };
}

/**
 * Genera el copy de la landing: campos afinados (público, descripción, ángulo) y
 * las 9 secciones (headline + bullets), todo en español. Si compliance está activo,
 * aplica las reglas TikTok-safe.
 */
export async function landingCopy(inputs: LandingCopyInputs, complianceTiktok: boolean): Promise<LandingCopy> {
  const generator = getTextGenerator();

  const base = await getPrompt(PROMPT_KEYS.LANDING_COPY_SYSTEM);
  const system = complianceTiktok
    ? `${base}\n${await getPrompt(PROMPT_KEYS.COMPLIANCE_TIKTOK)}`
    : base;

  const user = [
    `Producto: ${inputs.productName}`,
    `País/mercado: ${inputs.country}`,
    inputs.audience ? `Público (referencia): ${inputs.audience}` : '',
    inputs.angle ? `Ángulo (referencia): ${inputs.angle}` : '',
    inputs.description ? `Descripción (referencia): ${inputs.description}` : '',
    inputs.offerType ? `Tipo de oferta: ${inputs.offerType}` : '',
    'Devuelve audience, description y angle afinados, y las 9 secciones con headline y bullets.',
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await generator.complete(system, user, true);
  const parsed = parseJsonLoose<Partial<LandingCopy> & { sections?: unknown }>(raw);

  return {
    audience: String(parsed.audience ?? '').trim(),
    description: String(parsed.description ?? '').trim(),
    angle: String(parsed.angle ?? '').trim(),
    sections: normalizeSections(parsed.sections),
  };
}
