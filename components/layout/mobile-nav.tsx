'use client';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import type { Theme } from '@/lib/theme';

/**
 * Barra superior + menú lateral (drawer) para móvil/tablet (<md). El botón
 * hamburguesa abre un Dialog de Radix reestilizado como panel pegado a la
 * izquierda, que reutiliza el mismo SidebarNav que el sidebar de escritorio.
 */
export function MobileNav({ userName, theme }: { userName: string; theme: Theme }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-lg font-bold tracking-tight">Win<span className="text-sky-400">Spy</span></span>
      </header>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-0 top-0 h-screen max-h-screen w-60 max-w-[85vw] translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-y-0 border-l-0 border-r p-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left">
          <DialogTitle className="sr-only">Navegación</DialogTitle>
          <SidebarNav userName={userName} theme={theme} onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
