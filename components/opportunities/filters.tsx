'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

const TOGGLES = [
  { key: 'noCO', label: 'Solo no-CO' },
  { key: 'dropi', label: 'Con Dropi' },
  { key: 'creativos', label: 'Con creativos' },
];
const SOURCES = ['mercadolibre', 'trends', 'meta', 'tiktok'];

/** Barra de filtros que escribe los parámetros en la URL (los lee el server). */
export function OpportunityFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {TOGGLES.map((t) => (
        <Button key={t.key} size="sm" variant={sp.get(t.key) ? 'default' : 'outline'} onClick={() => set(t.key, sp.get(t.key) ? null : '1')}>
          {t.label}
        </Button>
      ))}
      <select
        value={sp.get('fuente') ?? ''}
        onChange={(e) => set('fuente', e.target.value || null)}
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        <option value="">Todas las fuentes</option>
        {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}
