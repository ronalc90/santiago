import { ImageGenerator, RefImage } from '@/lib/images/types';
import { StyleAnalysis, STYLE_ANALYSIS_PROMPT } from '@/lib/services/landing-spec';
import { getEnv } from '@/lib/config/env';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Generador real con la API de Google Gemini.
 * - Análisis de estilo: modelo de texto/visión (GEMINI_TEXT_MODEL).
 * - Generación de imágenes: modelo de imagen (GEMINI_IMAGE_MODEL, "nano banana").
 * Autenticación por header `X-goog-api-key`.
 */
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

  private async call(model: string, body: unknown): Promise<any> {
    const res = await fetch(`${API_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini ${model} respondió ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  }

  async analyzeReference(image: RefImage): Promise<StyleAnalysis> {
    const data = await this.call(this.textModel, {
      contents: [
        {
          parts: [
            { text: STYLE_ANALYSIS_PROMPT },
            { inlineData: { mimeType: image.mimeType, data: image.data.toString('base64') } },
          ],
        },
      ],
    });
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') ?? '';
    // El modelo puede envolver el JSON en ```json ... ```
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
    const parts: any[] = [{ text: prompt }];
    for (const ref of refs ?? []) {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data.toString('base64') } });
    }
    const data = await this.call(this.imageModel, {
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'] },
    });
    const partsOut: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = partsOut.find((p) => p.inlineData?.data);
    if (!imgPart) {
      throw new Error('Gemini no devolvió ninguna imagen.');
    }
    return Buffer.from(imgPart.inlineData.data, 'base64');
  }
}
