import { SidebarNav } from '@/components/layout/sidebar-nav';
import type { Theme } from '@/lib/theme';

/** Sidebar fijo de escritorio. Oculto en móvil (<md); ahí navega el MobileNav. */
export function Sidebar({ userName, theme }: { userName: string; theme: Theme }) {
  return (
    <aside className="hidden h-screen w-60 shrink-0 border-r bg-card md:block">
      <SidebarNav userName={userName} theme={theme} />
    </aside>
  );
}
