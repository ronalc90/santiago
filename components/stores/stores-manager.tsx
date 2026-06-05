'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { normalizeAdLibraryUrl } from '@/lib/ad-library';

interface StoreRow { id: string; name: string; country: string; adLibraryUrl: string; notes: string; adsCount: number; }

export function StoresManager({ initial }: { initial: StoreRow[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('CO');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch('/api/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, country, adLibraryUrl: url }) });
    setLoading(false);
    if (res.ok) { setName(''); setUrl(''); router.refresh(); }
    else { const r = await res.json(); toast({ variant: 'destructive', title: 'Error', description: r.error }); }
  }

  async function remove(id: string) {
    await fetch(`/api/stores/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full space-y-1 sm:w-48"><Label className="text-xs">Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" placeholder="Tienda competidora" /></div>
          <div className="w-full space-y-1 sm:w-20"><Label className="text-xs">País</Label><Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} className="w-full" maxLength={4} /></div>
          <div className="w-full space-y-1 sm:w-72"><Label className="text-xs">URL Ad Library</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full" placeholder="https://facebook.com/ads/library/…" /></div>
          <Button onClick={add} disabled={loading} className="w-full sm:w-auto">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar</Button>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        {initial.length === 0 && <p className="text-sm text-muted-foreground">Sin tiendas. Agrega la primera arriba.</p>}
        {initial.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name} <Badge variant="outline" className="ml-1">{s.country}</Badge></p>
                <p className="text-xs text-muted-foreground">{s.adsCount} anuncio(s)</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <a href={normalizeAdLibraryUrl(s.adLibraryUrl, { query: s.name, country: s.country })} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-4 w-4" /></a>
                <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
