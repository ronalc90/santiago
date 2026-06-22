'use client';
import { useEffect, useState } from 'react';
import { Sun, Moon, BookOpen, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { THEMES, THEME_LABELS, type Theme, applyTheme } from '@/lib/theme';

const ICONS: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, reading: BookOpen };
const THEME_EVENT = 'winspy-theme';

/**
 * Selector de apariencia (claro/oscuro/lectura). Aplica el tema al instante,
 * lo cachea en localStorage y lo persiste por usuario en la BD. La BD es la
 * fuente de verdad: al montar sincroniza el tema del usuario (cubre un
 * dispositivo nuevo). Varias instancias (sidebar + Ajustes) se mantienen en
 * sync vía un evento de ventana.
 */
export function ThemeSwitcher({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    applyTheme(initial);
    setTheme(initial);
  }, [initial]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const t = (e as CustomEvent<Theme>).detail;
      if (t) setTheme(t);
    };
    window.addEventListener(THEME_EVENT, onChange as EventListener);
    return () => window.removeEventListener(THEME_EVENT, onChange as EventListener);
  }, []);

  async function select(next: Theme) {
    if (next === theme) return;
    const prev = theme;
    setTheme(next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
    try {
      const res = await fetch('/api/settings/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      });
      if (!res.ok) throw new Error('persist failed');
    } catch {
      setTheme(prev);
      applyTheme(prev);
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: prev }));
      toast({ variant: 'destructive', title: 'No se pudo guardar el tema', description: 'Revisa tu conexión e inténtalo de nuevo.' });
    }
  }

  return (
    <div className="grid grid-cols-3 gap-1 rounded-md bg-secondary/60 p-1" role="group" aria-label="Tema">
      {THEMES.map((t) => {
        const Icon = ICONS[t];
        const active = t === theme;
        return (
          <button
            key={t}
            type="button"
            onClick={() => select(t)}
            aria-pressed={active}
            title={THEME_LABELS[t]}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors',
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{THEME_LABELS[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
