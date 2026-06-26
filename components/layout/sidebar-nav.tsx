'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Telescope, Trophy, Package, Boxes, ImageIcon, Store, Settings, DollarSign, HelpCircle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import type { Theme } from '@/lib/theme';

/** Menú agrupado por etapa del flujo de trabajo, para que un usuario nuevo
 *  entienda el orden: descubrir → operar → admin. */
export const NAV_SECTIONS: { title: string | null; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  { title: null, items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Descubrir',
    items: [
      { href: '/spy', label: 'Spy de anuncios', icon: Telescope },
      { href: '/opportunities', label: 'Oportunidades', icon: Trophy },
      { href: '/catalogo', label: 'Catálogo Dropi', icon: Boxes },
    ],
  },
  {
    title: 'Operar',
    items: [
      { href: '/products', label: 'Mis productos', icon: Package },
      { href: '/landings', label: 'Landings', icon: ImageIcon },
    ],
  },
  {
    title: 'Admin e info',
    items: [
      { href: '/stores', label: 'Competidores', icon: Store },
      { href: '/costos', label: 'Costos', icon: DollarSign },
      { href: '/settings', label: 'Ajustes', icon: Settings },
      { href: '/ayuda', label: 'Ayuda', icon: HelpCircle },
    ],
  },
];

/**
 * Contenido de la navegación (logo + enlaces + pie con usuario/salir).
 * Se reutiliza tal cual en el sidebar fijo de escritorio y en el drawer móvil,
 * así la lista NAV vive en un solo sitio. `onNavigate` permite cerrar el drawer
 * al pulsar un enlace en móvil.
 */
export function SidebarNav({ userName, theme, onNavigate }: { userName: string; theme: Theme; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    onNavigate?.();
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-bold tracking-tight">Win<span className="text-sky-400">Spy</span></span>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto p-2">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.title ?? `s${si}`} className="space-y-1">
            {section.title && (
              <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{section.title}</p>
            )}
            {section.items.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t p-2">
        <div className="truncate px-3 py-2 text-xs text-muted-foreground">{userName}</div>
        <div className="px-1 pb-1">
          <ThemeSwitcher initial={theme} />
        </div>
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={logout}>
          <LogOut className="h-4 w-4" /> Salir
        </Button>
      </div>
    </div>
  );
}
