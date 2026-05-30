import { TextGenerator } from '@/lib/text/types';
import { getEnv } from '@/lib/config/env';

/** Generador de texto con Gemini (reutiliza la key de imágenes). */
export class GeminiTextGenerator implements TextGenerator {
  private apiKey: string;
  private model: string;

  constructor() {
    const env = getEnv();
    this.apiKey = env.GEMINI_API_KEY;
    this.model = env.GEMINI_TEXT_MODEL;
  }

  async complete(system: string, user: string, jsonMode = false): Promise<string> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: jsonMode ? { responseMimeType: 'application/json' } : {},
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini (texto) respondió ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).filter(Boolean).join('') ?? ''
    );
  }
}
