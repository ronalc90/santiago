'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

/**
 * Dispara la ingesta de anuncios REALES (POST /api/ads/sync). Encola un job por
 * keyword configurada (AD_SOURCE_KEYWORDS); el worker los procesa y trae los
 * anuncios reales del Meta Ad Library con su creativo.
 */
export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function sync() {
    setLoading(true);
    try {
      const res = await fetch('/api/ads/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: 'Sincronización en cola',
          description: `${data.enqueued ?? 0} búsqueda(s) encoladas para ${data.country ?? ''}. El worker traerá los anuncios reales en breve; recarga en unos segundos.`,
        });
        setTimeout(() => router.refresh(), 4000);
      } else {
        toast({
          variant: 'destructive',
          title: 'No se pudo sincronizar',
          description: data.error ?? `Error ${res.status}`,
        });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error de red', description: err instanceof Error ? err.message : 'desconocido' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={sync} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Sincronizar reales
    </Button>
  );
}
