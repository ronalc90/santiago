import { TextGenerator } from '@/lib/text/types';
import { getEnv } from '@/lib/config/env';

/** Generador de texto con la API de OpenAI (chat completions). */
export class OpenAITextGenerator implements TextGenerator {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    const env = getEnv();
    this.apiKey = env.OPENAI_API_KEY;
    this.model = env.OPENAI_TEXT_MODEL;
    this.baseUrl = env.OPENAI_BASE_URL.replace(/\/$/, '');
  }

  async complete(system: string, user: string, jsonMode = false): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI respondió ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
}
