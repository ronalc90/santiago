'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

/** Países donde se puede buscar en el Ad Library de Meta (demanda intl). */
const COUNTRIES = [
  { code: 'CO', label: 'Colombia' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'MX', label: 'México' },
  { code: 'ES', label: 'España' },
  { code: 'CL', label: 'Chile' },
  { code: 'AR', label: 'Argentina' },
  { code: 'PE', label: 'Perú' },
  { code: 'BR', label: 'Brasil' },
];
const MAX_LIMIT = 200;

/**
 * Busca anuncios reales del Ad Library de Meta (POST /api/ads/sync) preguntando
 * país, término (opcional) y cuántos traer. Corre en el worker, no bloquea la UI.
 */
export function SyncDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState('CO');
  const [term, setTerm] = useState('');
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const body: { country: string; limit: number; keywords?: string[] } = { country, limit };
      const t = term.trim();
      if (t) body.keywords = [t];
      const res = await fetch('/api/ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 202) {
        toast({
          title: 'Búsqueda en cola',
          description: `${data.enqueued ?? 0} búsqueda(s) en ${country}. El worker trae los anuncios; recarga en ~30 s.`,
        });
        setOpen(false);
        setTimeout(() => router.refresh(), 4000);
      } else {
        toast({ variant: 'destructive', title: 'No se pudo buscar', description: typeof data.error === 'string' ? data.error : `Error ${res.status}` });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error de red', description: err instanceof Error ? err.message : 'desconocido' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><Search className="h-4 w-4" /> Buscar anuncios</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buscar anuncios</DialogTitle>
          <DialogDescription>Trae anuncios del Ad Library de Meta para el país y la búsqueda que elijas. Corre en segundo plano.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">País</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label} ({c.code})</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Para hallar ganadores que aún no llegan a CO, busca en US / MX / ES.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Búsqueda (opcional)</Label>
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="nicho o palabra clave · vacío = usa las configuradas" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cuántos traer (por búsqueda)</Label>
            <Input
              type="number"
              min={1}
              max={MAX_LIMIT}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(MAX_LIMIT, Number(e.target.value) || 1)))}
            />
            <p className="text-xs text-muted-foreground">Más anuncios = más costo de scraping (Apify cobra por resultado). Máx {MAX_LIMIT}.</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Buscar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
