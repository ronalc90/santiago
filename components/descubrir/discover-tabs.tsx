'use client';
import Link from 'next/link';
import { Telescope, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'anuncios', label: 'Anuncios ganadores', icon: Telescope },
  { key: 'oportunidades', label: 'Oportunidades', icon: Trophy },
] as const;

export type DiscoverView = (typeof TABS)[number]['key'];

/**
 * Selector de pestañas de «Descubrir». Cada pestaña es un enlace que cambia el
 * parámetro `?vista=`; el server decide qué motor renderiza. `current` viene del
 * server para marcar la activa sin depender de hooks de cliente.
 */
export function DiscoverTabs({ current }: { current: DiscoverView }) {
  return (
    <div role="tablist" aria-label="Modo de descubrimiento" className="inline-flex flex-wrap gap-1 rounded-lg border bg-secondary/30 p-1">
      {TABS.map((t) => {
        const active = t.key === current;
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={`/descubrir?vista=${t.key}`}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
