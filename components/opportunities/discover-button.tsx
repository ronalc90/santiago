'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';

/**
 * Dispara el descubrimiento y MUESTRA el progreso: sondea /api/discovery/status
 * cada 6 s; mientras el worker trabaja muestra «Buscando productos…» y, al
 * terminar, refresca la lista solo. Las fuentes gratis no cuestan; si hay de pago
 * activas, pide confirmación de costo.
 */
export function DiscoverButton({ paidActive = false }: { paidActive?: boolean }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const wasRunning = useRef(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/discovery/status');
        if (!res.ok || !alive) return;
        const d = await res.json();
        const now = Boolean(d.running);
        if (!now && wasRunning.current) {
          toast({ title: 'Búsqueda terminada', description: 'Candidatos actualizados.' });
          router.refresh();
        }
        wasRunning.current = now;
        setRunning(now);
      } catch {
        /* ignora errores transitorios de red */
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [router]);

  /** Pulsar el botón: si hay fuentes de pago, pide confirmación de costo; si no, corre directo. */
  function handleClick() {
    if (paidActive) setConfirmOpen(true);
    else void run();
  }

  async function run() {
    setConfirmOpen(false);
    setStarting(true);
    const res = await fetch('/api/discovery/run', { method: 'POST' });
    setStarting(false);
    if (res.ok) {
      setRunning(true);
      wasRunning.current = true;
      toast({ title: 'Búsqueda iniciada', description: 'Corriendo en segundo plano; verás el progreso aquí.' });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'No se pudo iniciar', description: d.error });
    }
  }

  if (running) {
    return (
      <Button disabled variant="outline" className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando productos…
      </Button>
    );
  }
  return (
    <>
      <Button onClick={handleClick} disabled={starting} className="gap-2">
        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar ahora
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Fuentes de pago activas"
        description="Hay fuentes de PAGO activas (Apify). Esta búsqueda puede generar costo. ¿Continuar?"
        confirmLabel="Continuar"
        loading={starting}
        onConfirm={() => void run()}
      />
    </>
  );
}
