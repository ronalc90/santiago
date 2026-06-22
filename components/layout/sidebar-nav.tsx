'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Telescope, Trophy, Package, ImageIcon, Store, Settings, DollarSign, HelpCircle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import type { Theme } from '@/lib/theme';

export const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/spy', label: 'Spy de anuncios', icon: Telescope },
  { href: '/opportunities', label: 'Oportunidades', icon: Trophy },
  { href: '/products', label: 'Productos', icon: Package },
  { href: '/landings', label: 'Landings', icon: ImageIcon },
  { href: '/stores', label: 'Tiendas', icon: Store },
  { href: '/settings', label: 'Ajustes', icon: Settings },
  { href: '/costos', label: 'Costos', icon: DollarSign },
  { href: '/ayuda', label: 'Ayuda', icon: HelpCircle },
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
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV.map((item) => {
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
