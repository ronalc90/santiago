'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const DROPI = [
  { value: 'DESCONOCIDO', label: 'Desconocido' },
  { value: 'DISPONIBLE', label: 'Disponible en Dropi' },
  { value: 'NO_DISPONIBLE', label: 'No disponible' },
  { value: 'A_IMPORTAR', label: 'A importar' },
];

const EMPTY = {
  name: '',
  description: '',
  market: 'CO',
  currency: 'COP',
  dropiAvailability: 'DESCONOCIDO',
  notes: '',
};

/**
 * Crea un producto manualmente (sin partir de un anuncio del Spy). Postea al
 * mismo endpoint que la creación desde un anuncio; al crearse, navega al detalle.
 */
export function NewProductDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    const name = form.name.trim();
    if (!name) {
      toast({ variant: 'destructive', title: 'El nombre es obligatorio' });
      return;
    }
    setSaving(true);
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: form.description.trim() || undefined,
        market: form.market.trim().toUpperCase() || 'CO',
        currency: form.currency.trim().toUpperCase() || 'COP',
        dropiAvailability: form.dropiAvailability,
        notes: form.notes.trim() || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const { product } = await res.json();
      toast({ title: 'Producto creado' });
      setOpen(false);
      setForm(EMPTY);
      router.push(`/products/${product.id}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast({ variant: 'destructive', title: data.error ?? 'No se pudo crear el producto' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Nuevo producto
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
          <DialogDescription>Crea un producto a mano para gestionarlo en el pipeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-name" className="text-xs">Nombre *</Label>
            <Input id="np-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre comercial del producto" autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-market" className="text-xs">Mercado</Label>
              <Input id="np-market" value={form.market} onChange={(e) => set('market', e.target.value)} maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-currency" className="text-xs">Moneda</Label>
              <Input id="np-currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} maxLength={4} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dropi</Label>
              <Select value={form.dropiAvailability} onValueChange={(v) => set('dropiAvailability', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DROPI.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-description" className="text-xs">Descripción</Label>
            <Textarea id="np-description" value={form.description} onChange={(e) => set('description', e.target.value)} className="min-h-[72px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-notes" className="text-xs">Notas</Label>
            <Textarea id="np-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-[72px]" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !form.name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
