'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // Borrador del producto (precargable con IA antes de crearlo).
  const [name, setName] = useState(props.defaultProductName);
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('');
  const [angle, setAngle] = useState('');

  async function suggestWithAI() {
    setSuggesting(true);
    try {
      const res = await fetch('/api/ai/suggest-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: props.adId }),
      });
      const r = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Error', description: r.error });
        return;
      }
      const s = r.suggestion;
      if (s.name) setName(s.name);
      setDescription(s.description ?? '');
      setAudience(s.audience ?? '');
      setAngle(s.angle ?? '');
      toast({ title: 'Sugerencia lista', description: 'Revisa y ajusta antes de crear el producto.' });
    } finally {
      setSuggesting(false);
    }
  }

  async function createProduct() {
    setCreating(true);
    const notes = [audience && `Público: ${audience}`, angle && `Ángulo: ${angle}`].filter(Boolean).join('\n');
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || undefined,
        notes: notes || undefined,
        sellsInColombia: props.sellsInColombia,
        hasUnusedForeignCreative: props.hasUnusedForeignCreative,
        fromAdId: props.adId,
      }),
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
      <p className="text-xs text-muted-foreground">Las detecta el sistema desde el anuncio (no se editan a mano).</p>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm">Se vende en Colombia</span>
        {props.sellsInColombia ? <Badge variant="green" className="shrink-0">Sí</Badge> : <Badge variant="gray" className="shrink-0">No</Badge>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm">Creativo extranjero sin usar en CO</span>
        {props.hasUnusedForeignCreative ? <Badge variant="yellow" className="shrink-0">Sí</Badge> : <Badge variant="gray" className="shrink-0">No</Badge>}
      </div>
      <div className="border-t pt-4">
        {props.productId ? (
          <Link href={`/products/${props.productId}`}><Button variant="outline" className="w-full">Ver producto: {props.productName}</Button></Link>
        ) : (
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={suggestWithAI} disabled={suggesting}>
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Sugerir con IA
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nombre del producto</Label>
              <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Descripción</Label>
              <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Se precargará con la sugerencia de IA" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-aud">Público objetivo</Label>
              <Input id="p-aud" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-angle">Ángulo de venta</Label>
              <Input id="p-angle" value={angle} onChange={(e) => setAngle(e.target.value)} />
            </div>
            <Button className="w-full" onClick={createProduct} disabled={creating || !name.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />} Crear producto desde este anuncio
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
