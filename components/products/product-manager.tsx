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
import { PRODUCT_STATUSES, DROPI_OPTIONS } from '@/lib/products/labels';

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
  realRoas: number | null;
  realCpa: number | null;
  realUnitsSold: number | null;
  realReturnRate: number | null; // 0-1
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
  const savedRoas = useRef(product.realRoas);
  const savedCpa = useRef(product.realCpa);
  const savedUnits = useRef(product.realUnitsSold);
  const savedReturn = useRef(product.realReturnRate);

  /** Input numérico de costo/precio/resultado con patch solo si cambió (evita recompute innecesario). */
  function numberField(
    label: string,
    key: 'salePrice' | 'manualCost' | 'shippingCost' | 'realRoas' | 'realCpa' | 'realUnitsSold',
    ref: typeof savedSalePrice,
    placeholder: string,
    step?: string,
    money?: boolean,
  ) {
    const fieldId = `pf-${key}`;
    const val = s[key];
    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldId} className="text-xs">{label}</Label>
        <Input
          id={fieldId}
          type="number"
          min={0}
          step={step}
          value={val ?? ''}
          onChange={(e) => setS({ ...s, [key]: e.target.value === '' ? null : Number(e.target.value) })}
          onBlur={() => {
            if (s[key] !== ref.current) {
              ref.current = s[key];
              patch({ [key]: s[key] });
            }
          }}
          placeholder={placeholder}
        />
        {money && val != null && val > 0 && (
          <p className="text-xs text-muted-foreground">= {formatMoney(val, s.currency)}</p>
        )}
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
          <Label htmlFor="pf-status" className="text-xs">Etapa del pipeline</Label>
          <Select value={s.status} onValueChange={(v) => patch({ status: v })}>
            <SelectTrigger id="pf-status"><SelectValue /></SelectTrigger>
            <SelectContent>{PRODUCT_STATUSES.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-dropi" className="text-xs">Disponibilidad Dropi</Label>
          <Select value={s.dropiAvailability} onValueChange={(v) => patch({ dropiAvailability: v })}>
            <SelectTrigger id="pf-dropi"><SelectValue /></SelectTrigger>
            <SelectContent>{DROPI_OPTIONS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {numberField(`Precio de venta (${s.currency})`, 'salePrice', savedSalePrice, 'ej: 89900', undefined, true)}
        {s.shopifyUnitCost != null ? (
          <p className="text-xs text-muted-foreground">
            Costo Shopify: <span className="font-medium">{formatMoney(s.shopifyUnitCost, s.currency)}</span> (sincronizado · se usa para el margen)
          </p>
        ) : (
          numberField(`Costo por artículo (${s.currency})`, 'manualCost', savedManualCost, 'manual; o sincroniza desde Shopify', undefined, true)
        )}
        {numberField(`Costo de envío (${s.currency})`, 'shippingCost', savedShipping, 'opcional', undefined, true)}
        <p className="text-xs text-muted-foreground">
          Precio, costo y envío alimentan el <span className="font-medium">margen efectivo COD</span>: descuenta la no entrega
          (cancelaciones/rechazos), el flete de vuelta y la comisión de recaudo. Esos parámetros se ajustan en Ajustes.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="pf-keyword" className="text-xs">Keyword de saturación (MercadoLibre)</Label>
          <Input
            id="pf-keyword"
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
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Resultados reales <span className="font-normal text-muted-foreground">(cierra el loop)</span></p>
            {s.realRoas != null && (
              <Badge variant={s.realRoas >= 1.5 ? 'green' : s.realRoas < 1 ? 'red' : 'yellow'}>
                {s.realRoas >= 1.5 ? '✅ Validado' : s.realRoas < 1 ? '❌ Pierde plata' : '⚠️ Marginal'}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {numberField('ROAS real', 'realRoas', savedRoas, 'ej: 2.5', '0.1')}
            {numberField(`CPA real (${s.currency})`, 'realCpa', savedCpa, 'costo por venta')}
            {numberField('Unidades vendidas', 'realUnitsSold', savedUnits, 'ej: 120')}
            <div className="space-y-1.5">
              <Label htmlFor="pf-return" className="text-xs">No entrega real (%)</Label>
              <Input
                id="pf-return"
                type="number"
                min={0}
                max={100}
                value={s.realReturnRate != null ? Math.round(s.realReturnRate * 100) : ''}
                onChange={(e) => setS({ ...s, realReturnRate: e.target.value === '' ? null : Number(e.target.value) / 100 })}
                onBlur={() => {
                  if (s.realReturnRate !== savedReturn.current) {
                    savedReturn.current = s.realReturnRate;
                    patch({ realReturnRate: s.realReturnRate });
                  }
                }}
                placeholder="ej: 25"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">La «no entrega real» reemplaza el default en el margen efectivo COD: el score aprende de tus números.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-notes" className="text-xs">Notas</Label>
          <Textarea id="pf-notes" value={s.notes} onChange={(e) => setS({ ...s, notes: e.target.value })} onBlur={() => patch({ notes: s.notes })} className="min-h-[100px]" />
        </div>
      </CardContent>
    </Card>
  );
}
