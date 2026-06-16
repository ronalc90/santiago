'use client';
import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

/** Dispara la medición de saturación en MercadoLibre (worker, no bloquea la UI). */
export function MeliSaturationButton() {
  const [loading, setLoading] = useState(false);

  async function measure() {
    setLoading(true);
    const res = await fetch('/api/integrations/meli/saturation/sync', { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      toast({ title: 'Medición iniciada', description: 'La saturación se actualiza en segundo plano; recarga en un momento.' });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'No se pudo iniciar', description: d.error });
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={measure} disabled={loading} title="Medir saturación en MercadoLibre">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Medir saturación
    </Button>
  );
}
