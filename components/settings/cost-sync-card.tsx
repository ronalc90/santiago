'use client';
import { useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

export interface CostSyncStatus {
  configured: boolean;
  missingScope: boolean;
  total: number;
  matched: number;
  updated: number;
  withoutCost: number;
  ambiguousTitles?: number;
  at: string;
}

export function CostSyncCard({ status, shopifyConfigured }: { status: CostSyncStatus | null; shopifyConfigured: boolean }) {
  const [loading, setLoading] = useState(false);

  async function sync() {
    setLoading(true);
    const res = await fetch('/api/costs/sync-shopify', { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      toast({ title: 'Sincronización iniciada', description: 'Los costos se actualizan en segundo plano; recarga en un momento para ver el resultado.' });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'No se pudo iniciar', description: d.error });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Costos (Shopify)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Lee el «costo por artículo» de Shopify (que Dropi sincroniza a tu tienda) y lo usa para el margen del score. También corre solo a diario.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={sync} disabled={loading || !shopifyConfigured} title={shopifyConfigured ? 'Traer costos de Shopify' : 'Conecta Shopify primero'}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar costos (Shopify)
        </Button>
        {status?.missingScope && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Falta el scope <b>read_inventory</b> en la app de Shopify. Actualiza los permisos de la Custom App (Admin API → marca read_inventory)
              y reinstálala para poder leer costos.
            </span>
          </div>
        )}
        {shopifyConfigured && status && !status.missingScope && status.at && (
          <p className="text-xs text-muted-foreground">
            Última sync: <span className="font-medium">{status.updated}</span> actualizados · {status.matched} emparejados · {status.withoutCost} sin costo (de {status.total}).
            {status.ambiguousTitles ? ` · ${status.ambiguousTitles} título(s) duplicado(s) en Shopify sin emparejar.` : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
