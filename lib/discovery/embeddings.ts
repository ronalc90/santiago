import 'server-only';
import { getEnv } from '@/lib/config/env';

/**
 * Embeddings de OpenAI para deduplicar candidatos casi-idénticos entre fuentes
 * (p. ej. "masajeador de cuello" vs "masajeador cervical"). Degrada a null si no
 * hay OPENAI_API_KEY o la API falla (la dedupe por nombre normalizado sigue).
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const env = getEnv();
  if (!env.OPENAI_API_KEY || !texts.length) return null;
  try {
    const res = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { embedding?: number[] }[] };
    const out = (data.data ?? []).map((d) => d.embedding ?? []);
    return out.length === texts.length && out.every((e) => e.length) ? out : null;
  } catch {
    return null;
  }
}

/** Similitud coseno entre dos vectores. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
