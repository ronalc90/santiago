'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { formatMoney } from '@/lib/format';

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
  salePrice: number | null;
  shopifyUnitCost: number | null;
  manualCost: number | null;
  shippingCost: number | null;
  saturationCount: number | null;
  saturationKeyword: string | null;
  notes: string;
}

export function ProductManager({ product }: { product: ProductState }) {
  const router = useRouter();
  const [s, setS] = useState(product);
  const [saving, setSaving] = useState(false);
  // Últimos valores confirmados por el servidor: evitan PATCH+recompute en un blur sin cambio.
  const savedSalePrice = useRef(product.salePrice);
  const savedManualCost = useRef(product.manualCost);
  const savedShipping = useRef(product.shippingCost);
  const savedKeyword = useRef(product.saturationKeyword);

  /** Input numérico de costo/precio con patch solo si cambió (evita recompute innecesario). */
  function numberField(label: string, key: 'salePrice' | 'manualCost' | 'shippingCost', ref: typeof savedSalePrice, placeholder: string) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          type="number"
          min={0}
          value={s[key] ?? ''}
          onChange={(e) => setS({ ...s, [key]: e.target.value === '' ? null : Number(e.target.value) })}
          onBlur={() => {
            if (s[key] !== ref.current) {
              ref.current = s[key];
              patch({ [key]: s[key] });
            }
          }}
          placeholder={placeholder}
        />
      </div>
    );
  }

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
        {numberField(`Precio de venta (${s.currency})`, 'salePrice', savedSalePrice, 'ej: 89900')}
        {s.shopifyUnitCost != null ? (
          <p className="text-xs text-muted-foreground">
            Costo Shopify: <span className="font-medium">{formatMoney(s.shopifyUnitCost, s.currency)}</span> (sincronizado · se usa para el margen)
          </p>
        ) : (
          numberField(`Costo por artículo (${s.currency})`, 'manualCost', savedManualCost, 'manual; o sincroniza desde Shopify')
        )}
        {numberField(`Costo de envío (${s.currency})`, 'shippingCost', savedShipping, 'opcional')}
        <div className="space-y-1.5">
          <Label className="text-xs">Keyword de saturación (MercadoLibre)</Label>
          <Input
            value={s.saturationKeyword ?? ''}
            onChange={(e) => setS({ ...s, saturationKeyword: e.target.value === '' ? null : e.target.value })}
            onBlur={() => {
              const next = s.saturationKeyword?.trim() ? s.saturationKeyword.trim() : null;
              if (next !== savedKeyword.current) {
                savedKeyword.current = next;
                patch({ saturationKeyword: next });
              }
            }}
            placeholder="vacío = usa el nombre del producto"
          />
          {s.saturationCount != null && (
            <p className="text-xs text-muted-foreground">Competencia ML: {s.saturationCount.toLocaleString('es-CO')} publicaciones (medido)</p>
          )}
        </div>
        {/* Señales DERIVADAS de los anuncios (las detecta el spy): solo-lectura.
            No son input manual; se actualizan solas al ingerir/sincronizar anuncios. */}
        <div className="space-y-1.5 rounded-md border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">Señales automáticas (según los anuncios)</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">Se vende en CO</span>
            {s.sellsInColombia ? <Badge variant="green">Sí</Badge> : <Badge variant="gray">No</Badge>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs">Creativo extranjero sin usar</span>
            {s.hasUnusedForeignCreative ? <Badge variant="yellow">Sí</Badge> : <Badge variant="gray">No</Badge>}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notas</Label>
          <Textarea value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} onBlur={() => patch({ notes: s.notes })} className="min-h-[100px]" />
        </div>
      </CardContent>
    </Card>
  );
}
