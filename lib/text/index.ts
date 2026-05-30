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
  return new MockTextGenerator();
}

export type { TextGenerator } from '@/lib/text/types';
