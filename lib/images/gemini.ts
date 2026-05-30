import { ImageGenerator, RefImage } from '@/lib/images/types';
import { StyleAnalysis, STYLE_ANALYSIS_PROMPT } from '@/lib/services/landing-spec';
import { getEnv } from '@/lib/config/env';

/**
 * Generador de imágenes con Google Gemini ("nano banana").
 *
 * Usa la API REST de Generative Language (v1beta) vía `fetch` con el header
 * `X-goog-api-key`. No depende del SDK @google/genai: así el bundle no arrastra
 * un paquete con resolución de módulos frágil en algunos entornos de build
 * (Vercel), y controlamos reintentos y errores de forma explícita.
 */
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_RETRIES = 3;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 120_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenerateContentBody = Record<string, any>;

export class GeminiImageGenerator implements ImageGenerator {
  private apiKey: string;
  private imageModel: string;
  private textModel: string;

  constructor() {
    const env = getEnv();
    this.apiKey = env.GEMINI_API_KEY;
    this.imageModel = env.GEMINI_IMAGE_MODEL;
    this.textModel = env.GEMINI_TEXT_MODEL;
  }

  /** Llama a generateContent con reintentos y backoff ante errores transitorios. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateContent(model: string, body: GenerateContentBody): Promise<any> {
    let lastError = '';
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': this.apiKey },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (res.ok) return res.json();

        const text = await res.text().catch(() => '');
        lastError = `Gemini ${model} respondió ${res.status}: ${text.slice(0, 300)}`;
        // Reintenta solo si es un error transitorio y quedan intentos.
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new Error(lastError);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        lastError = isAbort ? `Gemini ${model}: timeout tras ${REQUEST_TIMEOUT_MS / 1000}s` : message;
        // Errores de red/timeout también son reintentables.
        if (attempt < MAX_RETRIES && (isAbort || message.includes('fetch') || message.includes('network'))) {
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new Error(lastError);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(lastError || `Gemini ${model}: error desconocido`);
  }

  async analyzeReference(image: RefImage): Promise<StyleAnalysis> {
    const data = await this.generateContent(this.textModel, {
      contents: [
        {
          role: 'user',
          parts: [
            { text: STYLE_ANALYSIS_PROMPT },
            { inlineData: { mimeType: image.mimeType, data: image.data.toString('base64') } },
          ],
        },
      ],
    });
    const text: string =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') ?? '';
    const jsonStr = text.replace(/```json|```/g, '').trim();
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        visualStyle: String(parsed.visualStyle ?? ''),
        palette: Array.isArray(parsed.palette) ? parsed.palette.map(String) : [],
        atmosphere: String(parsed.atmosphere ?? ''),
        typography: String(parsed.typography ?? ''),
        iconStyle: String(parsed.iconStyle ?? ''),
        effects: String(parsed.effects ?? ''),
        layout: String(parsed.layout ?? ''),
        editorialDetails: String(parsed.editorialDetails ?? ''),
      };
    } catch {
      throw new Error('No se pudo parsear el análisis de estilo devuelto por Gemini.');
    }
  }

  async generateImage(prompt: string, refs?: RefImage[]): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [{ text: prompt }];
    for (const ref of refs ?? []) {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data.toString('base64') } });
    }
    const data = await this.generateContent(this.imageModel, {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'] },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partsOut: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = partsOut.find((p) => p.inlineData?.data);
    if (!imgPart) {
      throw new Error('Gemini no devolvió ninguna imagen.');
    }
    return Buffer.from(imgPart.inlineData.data, 'base64');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff exponencial: ~1s, 2s, 4s. */
function backoffMs(attempt: number): number {
  return 1000 * 2 ** (attempt - 1);
}
