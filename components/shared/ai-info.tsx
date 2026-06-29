'use client';
import { Info } from 'lucide-react';

export function AiInfo({ promptKey, label }: { promptKey: string; label: string }) {
  const title = `Texto generado por IA con el prompt «${label}». Clic para editarlo en Ajustes.`;
  return (
    <a
      href={`/settings#prompt-${promptKey}`}
      title={title}
      aria-label={title}
      className="inline-flex items-center text-muted-foreground hover:text-foreground"
    >
      <Info className="h-3.5 w-3.5" />
    </a>
  );
}
