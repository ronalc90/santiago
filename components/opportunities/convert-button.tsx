'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

/** Convierte un candidato en Producto (entra al pipeline) o lleva al producto ya creado. */
export function ConvertButton({ id, productId }: { id: string; productId: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (productId) {
    return (
      <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
        Ver producto
      </Button>
    );
  }

  async function convert() {
    setLoading(true);
    const res = await fetch(`/api/discovery/${id}/convert`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && d.productId) {
      toast({ title: 'Producto creado', description: 'Entró al pipeline; ya puedes generar su landing.' });
      router.push(`/products/${d.productId}`);
    } else {
      toast({ variant: 'destructive', title: 'No se pudo crear', description: d.error });
    }
  }

  return (
    <Button onClick={convert} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Crear producto
    </Button>
  );
}
