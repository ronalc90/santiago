'use client';
import { Info } from 'lucide-react';

/**
 * Indicador «ℹ️» junto a contenido generado por IA: explica de qué prompt salió y
 * enlaza a Ajustes para editarlo. Pasa `promptKey` (→ ancla #prompt-<key>) o un
 * `anchor` directo (p. ej. para el bloque de prompts de imagen).
 */
export function AiInfo({ promptKey, label, anchor }: { promptKey?: string; label: string; anchor?: string }) {
  const target = anchor ?? `prompt-${promptKey}`;
  const title = `Generado por IA con «${label}». Clic para editar el prompt en Ajustes.`;
  return (
    <a
      href={`/settings#${target}`}
      title={title}
      aria-label={title}
      className="inline-flex items-center text-muted-foreground hover:text-foreground"
    >
      <Info className="h-3.5 w-3.5" />
    </a>
  );
}
