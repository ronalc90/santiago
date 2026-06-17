'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OpportunityBadge } from '@/components/shared/opportunity-badge';
import { toast } from '@/components/ui/use-toast';

interface DimensionView {
  score: number | null;
  estimated: boolean;
  reasons?: string[];
}
interface CascadeView {
  score: number | null;
  reasons?: string[];
}
interface Breakdown {
  coverage?: number;
  dimensions?: Record<string, DimensionView>;
  cascade?: CascadeView;
}
interface OpportunityView {
  score: number | null;
  band: string | null;
  confidence: number | null;
  estimated: boolean;
  breakdown: Breakdown | null;
}

const DIMS: { key: string; label: string }[] = [
  { key: 'demand', label: 'Demanda internacional' },
  { key: 'competition', label: 'Competencia CO' },
  { key: 'margin', label: 'Margen' },
  { key: 'creatives', label: 'Creativos' },
];

export function OpportunityCard({ productId, initial }: { productId: string; initial: OpportunityView }) {
  const router = useRouter();
  const [op, setOp] = useState<OpportunityView>(initial);
  const [loading, setLoading] = useState(false);

  async function recompute() {
    setLoading(true);
    const res = await fetch(`/api/products/${productId}/opportunity`, { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      const { opportunity } = await res.json();
      setOp({
        score: opportunity.score,
        band: opportunity.band,
        confidence: opportunity.confidence,
        estimated: opportunity.estimated,
        breakdown: { coverage: opportunity.coverage, dimensions: opportunity.dimensions, cascade: opportunity.cascade },
      });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: 'No se pudo calcular', description: data.error });
    }
  }

  const dims = op.breakdown?.dimensions ?? {};
  const coverage = op.breakdown?.coverage;
  const cascade = op.breakdown?.cascade;
  const cascadeHigh = cascade?.score != null && cascade.score >= 60;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Oportunidad</CardTitle>
          <Button variant="ghost" size="sm" onClick={recompute} disabled={loading} title="Recalcular oportunidad">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Recalcular
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold">{op.score != null ? Math.round(op.score) : '—'}</span>
          <span className="text-sm text-muted-foreground">/100</span>
          <OpportunityBadge band={op.band} />
        </div>

        {op.estimated && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Score provisional{coverage != null ? ` · cobertura ${Math.round(coverage * 4)}/4` : ''}
              {op.confidence != null ? ` · confianza ${Math.round(op.confidence * 100)}%` : ''}. Conecta Dropi/MercadoLibre para datos reales.
            </span>
          </div>
        )}

        <div className="space-y-2">
          {DIMS.map(({ key, label }) => {
            const d = dims[key];
            const score = d?.score ?? null;
            const reasons = (d?.reasons ?? []).join(' · ');
            return (
              <div key={key} title={reasons || undefined}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    {label}
                    {d?.estimated && score != null && <Badge variant="yellow" className="px-1 py-0 text-[10px]">est.</Badge>}
                  </span>
                  <span className="font-medium">{score != null ? score : '—'}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-sky-400" style={{ width: `${score ?? 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {cascade?.score != null && (
          <div
            className={
              cascadeHigh
                ? 'rounded-md border border-sky-500/40 bg-sky-500/10 p-2 text-xs text-sky-700 dark:text-sky-300'
                : 'rounded-md border p-2 text-xs text-muted-foreground'
            }
            title={(cascade.reasons ?? []).join(' · ') || undefined}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                🌊 Winner global (cascada)
                {cascadeHigh && (
                  <Badge variant="green" className="px-1 py-0 text-[10px]">
                    entrar ya
                  </Badge>
                )}
              </span>
              <span className="font-medium">{cascade.score}</span>
            </div>
            {cascadeHigh && <p className="mt-0.5">Probado afuera y CO aún con espacio: ventana para entrar primero.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
