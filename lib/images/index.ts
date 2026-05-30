import { ImageGenerator } from '@/lib/images/types';
import { MockImageGenerator } from '@/lib/images/mock';
import { GeminiImageGenerator } from '@/lib/images/gemini';
import { getEnv } from '@/lib/config/env';

/** Devuelve el generador según IMAGE_PROVIDER (mock | gemini). */
export function getImageGenerator(): ImageGenerator {
  const env = getEnv();
  return env.IMAGE_PROVIDER === 'gemini' ? new GeminiImageGenerator() : new MockImageGenerator();
}

export type { ImageGenerator, RefImage } from '@/lib/images/types';
