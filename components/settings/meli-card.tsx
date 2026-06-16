'use client';
import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

export interface MeliSaturationStatus {
  configured: boolean;
  connected: boolean;
  total: number;
  measured: number;
  updated: number;
  withoutData: number;
  at: string;
}

export interface MeliConnectionInfo {
  connected: boolean;
  needsReconnect: boolean;
  externalId: string | null;
}

const NOTICES: Record<string, { tone: 'warn'; text: string }> = {
  denied: { tone: 'warn', text: 'Cancelaste la autorización de MercadoLibre. Vuelve a intentarlo cuando quieras.' },
  error: {
    tone: 'warn',
    text: 'No se pudo completar la conexión. Revisa que MELI_REDIRECT_URI coincida EXACTO con la URI registrada en la app de MercadoLibre, y que MELI_CLIENT_ID/SECRET y APP_URL estén bien en el despliegue.',
  },
  unconfigured: {
    tone: 'warn',
    text: 'MercadoLibre no está configurado: revisa las variables MELI_CLIENT_ID / MELI_CLIENT_SECRET y APP_URL en Vercel (y en el worker de Railway).',
  },
};

export function MeliCard({
  configured,
  connection,
  status,
  notice,
}: {
  configured: boolean;
  connection: MeliConnectionInfo;
  status: MeliSaturationStatus | null;
  notice?: string;
}) {
  const [loading, setLoading] = useState(false);
  const banner = notice ? NOTICES[notice] : undefined;

  // ?meli=connected → toast de éxito (los estados de error se muestran como banner).
  useEffect(() => {
    if (notice === 'connected') {
      toast({ title: 'MercadoLibre conectado', description: 'Ya puedes medir la saturación de tus productos.' });
    }
  }, [notice]);

  async function measure() {
    setLoading(true);
    const res = await fetch('/api/integrations/meli/saturation/sync', { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      toast({ title: 'Medición iniciada', description: 'La saturación se mide en segundo plano; recarga en un momento para ver el resultado.' });
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'No se pudo iniciar', description: d.error });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competencia (MercadoLibre)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Mide la saturación real en Colombia (nº de publicaciones por producto) y la usa en la dimensión «Competencia». También corre sola a diario.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {banner && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{banner.text}</span>
          </div>
        )}

        {!configured && (
          <p className="text-xs text-muted-foreground">
            Configura <b>MELI_CLIENT_ID</b> y <b>MELI_CLIENT_SECRET</b> para habilitar la conexión.
          </p>
        )}

        {configured && !connection.connected && (
          <a href="/api/integrations/meli/connect">
            <Button>
              <Link2 className="h-4 w-4" /> Conectar MercadoLibre
            </Button>
          </a>
        )}

        {configured && connection.connected && connection.needsReconnect && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              La conexión con MercadoLibre dejó de ser válida (pudo rotar <b>AUTH_SECRET</b>).{' '}
              <a href="/api/integrations/meli/connect" className="underline">Reconéctala</a> para volver a medir la saturación.
            </span>
          </div>
        )}

        {configured && connection.connected && !connection.needsReconnect && (
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Conectado{connection.externalId ? ` · usuario ${connection.externalId}` : ''}.
              <a href="/api/integrations/meli/connect" className="ml-1 text-muted-foreground underline hover:text-foreground">Reconectar</a>
            </p>
            <Button onClick={measure} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Medir saturación (MercadoLibre)
            </Button>
            {status && status.connected && status.at && (
              <p className="text-xs text-muted-foreground">
                Última medición: <span className="font-medium">{status.updated}</span> cambiaron · {status.measured} medidos · {status.withoutData} sin dato (de {status.total}).
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
