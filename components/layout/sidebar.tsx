import { SidebarNav } from '@/components/layout/sidebar-nav';

/** Sidebar fijo de escritorio. Oculto en móvil (<md); ahí navega el MobileNav. */
export function Sidebar({ userName }: { userName: string }) {
  return (
    <aside className="hidden h-screen w-60 shrink-0 border-r bg-card md:block">
      <SidebarNav userName={userName} />
    </aside>
  );
}
