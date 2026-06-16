'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

/**
 * Dispara una corrida de descubrimiento (POST /api/discovery/run) en el worker.
 * Las fuentes gratis (MercadoLibre) no cuestan; si hay fuentes de pago activas,
 * el aviso de costo se mostrará cuando se implementen (fase 2).
 */
export function DiscoverButton({ paidActive = false }: { paidActive?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    if (paidActive && !window.confirm('Hay fuentes de PAGO activas (Apify). Esta búsqueda puede generar costo. ¿Continuar?')) return;
    setLoading(true);
    const res = await fetch('/api/discovery/run', { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      toast({ title: 'Búsqueda iniciada', description: 'El worker está descubriendo productos; recarga en ~1 min para ver los candidatos.' });
      setTimeout(() => router.refresh(), 5000);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'No se pudo iniciar', description: d.error });
    }
  }

  return (
    <Button onClick={run} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar ahora
    </Button>
  );
}
