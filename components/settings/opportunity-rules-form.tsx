'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import type { OpportunityRules } from '@/lib/services/opportunity-rules';

const WEIGHTS: { key: keyof OpportunityRules['weights']; label: string }[] = [
  { key: 'demand', label: 'Demanda internacional' },
  { key: 'competition', label: 'Competencia Colombia' },
  { key: 'margin', label: 'Margen (Dropi)' },
  { key: 'creatives', label: 'Calidad de creativos' },
];
const BANDS: { key: keyof OpportunityRules['bands']; label: string }[] = [
  { key: 'excelente', label: '🟢 Excelente (≥)' },
  { key: 'muyBueno', label: '🟢 Muy bueno (≥)' },
  { key: 'bueno', label: '🔵 Bueno (≥)' },
  { key: 'riesgoso', label: '🟡 Riesgoso (≥)' },
];

export function OpportunityRulesForm({ initial }: { initial: OpportunityRules }) {
  const router = useRouter();
  const [r, setR] = useState<OpportunityRules>(initial);
  const [saving, setSaving] = useState(false);

  function setWeight(k: keyof OpportunityRules['weights'], v: number) {
    setR((prev) => ({ ...prev, weights: { ...prev.weights, [k]: v } }));
  }
  function setBand(k: keyof OpportunityRules['bands'], v: number) {
    setR((prev) => ({ ...prev, bands: { ...prev.bands, [k]: v } }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch('/api/settings/opportunity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(r),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast({ title: 'Reglas guardadas', description: `${data.recomputed} producto(s) recalculados.` });
      router.refresh();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: data.error });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motor de Oportunidad (4×25)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pesos por dimensión (se normalizan a 100%) y umbrales de banda. Al guardar, se recalculan todos los productos.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="text-xs text-muted-foreground">Pesos</Label>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {WEIGHTS.map((w) => (
              <div key={w.key} className="grid grid-cols-1 items-center gap-1 sm:grid-cols-2">
                <Label className="text-sm">{w.label}</Label>
                <Input type="number" min={0} value={r.weights[w.key]} onChange={(e) => setWeight(w.key, Number(e.target.value))} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Bandas (umbral de score)</Label>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BANDS.map((b) => (
              <div key={b.key} className="grid grid-cols-1 items-center gap-1 sm:grid-cols-2">
                <Label className="text-sm">{b.label}</Label>
                <Input type="number" min={0} max={100} value={r.bands[b.key]} onChange={(e) => setBand(b.key, Number(e.target.value))} />
              </div>
            ))}
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar y recalcular
        </Button>
      </CardContent>
    </Card>
  );
}
