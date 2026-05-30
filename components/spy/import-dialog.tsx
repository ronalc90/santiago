'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

const JSON_EXAMPLE = `{
  "ads": [
    {
      "store_name": "GadgetPro CO",
      "country": "CO",
      "ad_id": "AD-CO-9001",
      "ad_library_url": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=CO&q=GadgetPro%20CO&search_type=keyword_unordered",
      "copy_text": "Producto ganador…",
      "days_active": 12,
      "estimated_spend": 18000,
      "creative_url": "https://…/img.jpg"
    }
  ]
}`;

export function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [data, setData] = useState('');
  const [loading, setLoading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormat(file.name.endsWith('.csv') ? 'csv' : 'json');
    setData(await file.text());
  }

  async function submit() {
    if (!data.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, data }),
      });
      const r = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Error al importar', description: r.error });
        return;
      }
      toast({ title: 'Importación lista', description: `${r.created} nuevos · ${r.updated} actualizados · ${r.errors?.length ?? 0} errores` });
      setOpen(false);
      setData('');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Upload className="h-4 w-4" /> Importar resultados del spy</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar anuncios</DialogTitle>
          <DialogDescription>Pega el JSON/CSV del spy o sube un archivo (.json / .csv). La deduplicación es por ad_id.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant={format === 'json' ? 'default' : 'outline'} onClick={() => setFormat('json')}>JSON</Button>
            <Button size="sm" variant={format === 'csv' ? 'default' : 'outline'} onClick={() => setFormat('csv')}>CSV</Button>
            <input type="file" accept=".json,.csv" onChange={onFile} className="ml-auto text-xs" />
          </div>
          <Textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            placeholder={format === 'json' ? JSON_EXAMPLE : 'store_name,country,ad_id,ad_library_url,copy_text,days_active,estimated_spend,creative_url'}
            className="min-h-[260px] font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={loading || !data.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Importar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
