'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

export function AdActions(props: {
  adId: string;
  sellsInColombia: boolean;
  hasUnusedForeignCreative: boolean;
  productId: string | null;
  productName: string | null;
  defaultProductName: string;
}) {
  const router = useRouter();
  const [sellsCO, setSellsCO] = useState(props.sellsInColombia);
  const [unused, setUnused] = useState(props.hasUnusedForeignCreative);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  async function patch(data: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/ads/${props.adId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setSaving(false);
    router.refresh();
  }

  async function createProduct() {
    setCreating(true);
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: props.defaultProductName, sellsInColombia: sellsCO, hasUnusedForeignCreative: unused, fromAdId: props.adId }),
    });
    const r = await res.json();
    setCreating(false);
    if (res.ok) {
      toast({ title: 'Producto creado', description: 'Se enlazó este anuncio al nuevo producto.' });
      router.push(`/products/${r.product.id}`);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: r.error });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="sells">Se vende en Colombia</Label>
        <Switch id="sells" checked={sellsCO} onCheckedChange={(v) => { setSellsCO(v); patch({ sellsInColombia: v }); }} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="unused2">Creativo extranjero sin usar en CO</Label>
        <Switch id="unused2" checked={unused} onCheckedChange={(v) => { setUnused(v); patch({ hasUnusedForeignCreative: v }); }} />
      </div>
      {saving && <p className="text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin" /> Guardando…</p>}
      <div className="border-t pt-4">
        {props.productId ? (
          <Link href={`/products/${props.productId}`}><Button variant="outline" className="w-full">Ver producto: {props.productName}</Button></Link>
        ) : (
          <Button className="w-full" onClick={createProduct} disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />} Crear producto desde este anuncio
          </Button>
        )}
      </div>
    </div>
  );
}
