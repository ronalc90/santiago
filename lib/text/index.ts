import { TextGenerator } from '@/lib/text/types';
import { OpenAITextGenerator } from '@/lib/text/openai';
import { GeminiTextGenerator } from '@/lib/text/gemini';
import { MockTextGenerator } from '@/lib/text/mock';
import { getEnv } from '@/lib/config/env';

/** Devuelve el generador de texto según TEXT_PROVIDER (mock | openai | gemini). */
export function getTextGenerator(): TextGenerator {
  const env = getEnv();
  if (env.TEXT_PROVIDER === 'openai') return new OpenAITextGenerator();
  if (env.TEXT_PROVIDER === 'gemini') return new GeminiTextGenerator();
  // El mock solo existe para desarrollo/tests. En producción NUNCA debe emitir
  // copy de relleno ("Producto de ejemplo (mock)"): fallamos claro para que el
  // dato mock no llegue a la base ni a una landing real.
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'TEXT_PROVIDER="mock" en producción: configúralo como "openai" (con OPENAI_API_KEY) o "gemini".',
    );
  }
  return new MockTextGenerator();
}

export type { TextGenerator } from '@/lib/text/types';
