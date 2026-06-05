'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface Rules {
  lanzarScore: number; considerarScore: number; monitorearScore: number; saturadoDias: number; minDiasOtroPais: number;
}

const FIELDS: { key: keyof Rules; label: string; hint: string }[] = [
  { key: 'lanzarScore', label: '🔴 LANZAR (Winner Score ≥)', hint: 'Gasto/día alto: lanzar ya.' },
  { key: 'considerarScore', label: '🟡 CONSIDERAR (≥)', hint: 'Buena señal: evaluar.' },
  { key: 'monitorearScore', label: '🟢 MONITOREAR (≥)', hint: 'Señal temprana.' },
  { key: 'saturadoDias', label: '⚪ SATURADO (días activos ≥)', hint: 'Demasiado tiempo corriendo.' },
  { key: 'minDiasOtroPais', label: 'Mín. días en otro país', hint: '+ días fuera de CO = demanda real.' },
];

export function ScoringRulesForm({ initial }: { initial: Rules }) {
  const router = useRouter();
  const [r, setR] = useState<Rules>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch('/api/settings/scoring', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { toast({ title: 'Reglas guardadas', description: `${data.recomputed} anuncios reclasificados.` }); router.refresh(); }
    else toast({ variant: 'destructive', title: 'Error', description: data.error });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle>Reglas de clasificación</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-center sm:gap-4">
            <div><Label>{f.label}</Label><p className="text-xs text-muted-foreground">{f.hint}</p></div>
            <Input type="number" value={r[f.key]} onChange={(e) => setR({ ...r, [f.key]: Number(e.target.value) })} />
          </div>
        ))}
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar y reclasificar</Button>
      </CardContent>
    </Card>
  );
}
