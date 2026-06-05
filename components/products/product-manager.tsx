'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const STATUSES = ['DETECTADO', 'VALIDADO', 'LANDING_CREADA', 'LANZADO', 'ESCALANDO'];
const DROPI = ['DISPONIBLE', 'NO_DISPONIBLE', 'A_IMPORTAR', 'DESCONOCIDO'];

interface ProductState {
  id: string;
  status: string;
  market: string;
  currency: string;
  sellsInColombia: boolean;
  hasUnusedForeignCreative: boolean;
  dropiAvailability: string;
  notes: string;
}

export function ProductManager({ product }: { product: ProductState }) {
  const router = useRouter();
  const [s, setS] = useState(product);
  const [saving, setSaving] = useState(false);

  async function patch(data: Partial<ProductState>) {
    setSaving(true);
    const next = { ...s, ...data };
    setS(next);
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    setSaving(false);
    if (res.ok) router.refresh();
    else toast({ variant: 'destructive', title: 'Error al guardar' });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Gestión {saving && <Loader2 className="inline h-3 w-3 animate-spin" />}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Etapa del pipeline</Label>
          <Select value={s.status} onValueChange={(v) => patch({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Disponibilidad Dropi</Label>
          <Select value={s.dropiAvailability} onValueChange={(v) => patch({ dropiAvailability: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DROPI.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="sells-co" className="text-xs">Se vende en CO</Label>
          <Switch id="sells-co" checked={s.sellsInColombia} onCheckedChange={(v) => patch({ sellsInColombia: v })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="unused-foreign" className="text-xs">Creativo extranjero sin usar</Label>
          <Switch id="unused-foreign" checked={s.hasUnusedForeignCreative} onCheckedChange={(v) => patch({ hasUnusedForeignCreative: v })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notas</Label>
          <Textarea value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} onBlur={() => patch({ notes: s.notes })} className="min-h-[100px]" />
        </div>
      </CardContent>
    </Card>
  );
}
