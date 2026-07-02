'use client';
import Link from 'next/link';
import { Telescope, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'anuncios', label: 'Anuncios ganadores', icon: Telescope },
  { key: 'oportunidades', label: 'Oportunidades', icon: Sparkles },
] as const;

export type DiscoverView = (typeof TABS)[number]['key'];

/**
 * Selector de vistas de «Descubrir». Cada opción es un enlace que cambia el
 * parámetro `?vista=`; el server decide qué motor renderiza. Semánticamente es
 * NAVEGACIÓN (cada vista es una URL), no un widget de tabs ARIA: por eso usa
 * `<nav>` + `aria-current="page"` en vez de role=tablist/tab (que exigiría
 * tabpanel y navegación por flechas). `current` viene del server para marcar la
 * activa sin depender de hooks de cliente.
 */
export function DiscoverTabs({ current }: { current: DiscoverView }) {
  return (
    <nav aria-label="Modo de descubrimiento" className="inline-flex flex-wrap gap-1 rounded-lg border bg-secondary/30 p-1">
      {TABS.map((t) => {
        const active = t.key === current;
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={`/descubrir?vista=${t.key}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
