/**
 * Especificación de las 9 imágenes de una landing de ventas.
 *
 * Cada slot define:
 *  - type: identificador estable
 *  - title: etiqueta para la UI (español)
 *  - buildPrompt: genera el prompt en INGLÉS para Gemini, pero pidiendo que
 *    TODO el texto visible en la imagen vaya en ESPAÑOL.
 *
 * El prompt incorpora el "style analysis" (8 elementos extraídos de la imagen
 * de referencia) para mantener coherencia visual entre las 9 piezas.
 */

/** Copy por sección (1..9) generado por IA, para alinear el texto de cada imagen. */
export interface LandingSectionCopy {
  slot: number; // 1..9
  headline: string;
  bullets: string[];
}

export interface LandingInputs {
  productName: string;
  offerPrice: number;
  regularPrice: number;
  country: string;
  currency: string;
  audience: string;
  description: string;
  offerType: string; // p.ej. "2x1", "envío gratis", "50% OFF"
  angle: string; // ángulo de venta
  /** Copy por sección generado por IA (opcional): se inyecta en el prompt del slot. */
  sectionsCopy?: LandingSectionCopy[];
}

/** Los 8 elementos que se extraen de la imagen de referencia de estilo. */
export interface StyleAnalysis {
  visualStyle: string;
  palette: string[]; // colores HEX
  atmosphere: string;
  typography: string;
  iconStyle: string;
  effects: string;
  layout: string;
  editorialDetails: string;
}

export interface LandingSlot {
  slot: number; // 1..9
  type: string;
  title: string;
  /** Descripción del propósito de la imagen (en inglés, para el modelo). */
  intent: string;
}

export const LANDING_SLOTS: LandingSlot[] = [
  { slot: 1, type: 'hero', title: 'Hero / Producto principal', intent: 'Main hero shot of the product, premium and eye-catching, with the product name as a headline.' },
  { slot: 2, type: 'precio', title: 'Precio / Oferta', intent: 'Pricing and offer block: highlight the offer price vs the crossed-out regular price and the offer type.' },
  { slot: 3, type: 'antes_despues', title: 'Antes / Después', intent: 'Before/After comparison showing the transformation or problem solved by the product.' },
  { slot: 4, type: 'modo_uso', title: 'Modo de uso (3 pasos)', intent: 'How-to-use in 3 simple numbered steps with small illustrations.' },
  { slot: 5, type: 'beneficios', title: 'Beneficios', intent: 'Key benefits as an icon list (3-5 benefits), short Spanish labels.' },
  { slot: 6, type: 'ficha', title: 'Ficha técnica', intent: 'Technical specs sheet: dimensions, materials, battery, etc. in a clean table/grid.' },
  { slot: 7, type: 'garantia', title: 'Garantía / Cierre', intent: 'Guarantee and trust closing block: warranty badge, secure payment, satisfaction guarantee.' },
  { slot: 8, type: 'urgencia', title: 'Urgencia / Escasez', intent: 'Scarcity/urgency block: limited stock, countdown vibe, "compra hoy".' },
  { slot: 9, type: 'testimonios', title: 'Testimonios / Social proof', intent: 'Customer testimonials and star ratings as realistic review cards in Spanish.' },
];

/** Devuelve el slot por su número (1..9). */
export function getSlot(n: number): LandingSlot | undefined {
  return LANDING_SLOTS.find((s) => s.slot === n);
}

const COMPLIANCE_TIKTOK_RULES = `
COMPLIANCE (TikTok-safe): do NOT include medical claims, do NOT mention weight loss,
do NOT use absolute promises (no "cures", "guaranteed results", "100%"), avoid
before/after that implies medical treatment. Keep claims soft and lifestyle-oriented.`;

/**
 * Construye el prompt en inglés para una imagen concreta.
 * Texto visible SIEMPRE en español. Incorpora estilo y, opcionalmente,
 * las reglas de compliance para TikTok.
 */
export function buildImagePrompt(
  slot: LandingSlot,
  inputs: LandingInputs,
  style: StyleAnalysis | null,
  complianceTiktok: boolean,
): string {
  const styleBlock = style
    ? `
VISUAL STYLE (keep consistent across all images):
- Style: ${style.visualStyle}
- Color palette (HEX): ${style.palette.join(', ')}
- Atmosphere/lighting: ${style.atmosphere}
- Typography: ${style.typography}
- Icon style: ${style.iconStyle}
- Visual effects: ${style.effects}
- Layout: ${style.layout}
- Editorial details: ${style.editorialDetails}`
    : '\nVISUAL STYLE: clean modern e-commerce, premium, high contrast.';

  const sectionCopy = inputs.sectionsCopy?.find((s) => s.slot === slot.slot);
  const copyBlock = sectionCopy && (sectionCopy.headline || sectionCopy.bullets.length)
    ? `
SECTION COPY (use this exact Spanish text as the basis for the visible copy):
- Headline: ${sectionCopy.headline}
- Bullets: ${sectionCopy.bullets.join(' | ')}`
    : '';

  return `You are designing image ${slot.slot} of 9 for a Spanish-language e-commerce sales page (landing).
IMAGE PURPOSE: ${slot.intent}

PRODUCT CONTEXT:
- Product: ${inputs.productName}
- Description: ${inputs.description}
- Target audience: ${inputs.audience}
- Selling angle: ${inputs.angle}
- Offer type: ${inputs.offerType}
- Offer price: ${inputs.offerPrice} ${inputs.currency}
- Regular price: ${inputs.regularPrice} ${inputs.currency}
- Country/market: ${inputs.country}
${styleBlock}${copyBlock}

REQUIREMENTS:
- ALL visible text on the image MUST be in SPANISH (es).
- TEXT ACCURACY IS CRITICAL: spell every Spanish word correctly, with proper
  accents (á é í ó ú ñ ¡ ¿). If "SECTION COPY" is provided above, reproduce that
  text VERBATIM, character by character — do not paraphrase, translate, abbreviate
  or INVENT words. Use ONLY short, common, everyday Spanish words you can render
  flawlessly; AVOID long or technical words the renderer tends to mangle (e.g.
  prefer "Detalles" over "Especificaciones", "Cómo usarlo" over "Características").
  If you are unsure how a word is spelled, replace it with the shortest correct
  synonym. Re-read EVERY rendered word letter by letter and fix any typo, missing
  accent or doubled/dropped letter before finalizing.
- Vertical format suitable for Shopify product page (portrait ~5:6).
- Professional, high-resolution, conversion-focused composition.
${complianceTiktok ? COMPLIANCE_TIKTOK_RULES : ''}`.trim();
}

/**
 * Prompt para analizar la imagen de referencia y extraer los 8 elementos.
 * Pide salida en JSON estricto para parsearla.
 */
export const STYLE_ANALYSIS_PROMPT = `Analyze this reference image and extract its design system.
Return ONLY a JSON object (no markdown) with these exact keys:
{
  "visualStyle": string,
  "palette": string[]  // up to 5 HEX colors,
  "atmosphere": string,
  "typography": string,
  "iconStyle": string,
  "effects": string,
  "layout": string,
  "editorialDetails": string
}`;
