'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface Img { id: string; slot: number; type: string; status: string; url: string | null; error: string | null; }
const TITLES: Record<string, string> = {
  hero: 'Hero', precio: 'Precio', antes_despues: 'Antes/Después', modo_uso: 'Modo de uso',
  beneficios: 'Beneficios', ficha: 'Ficha técnica', garantia: 'Garantía', urgencia: 'Urgencia', testimonios: 'Testimonios',
};

export function LandingDetail({ id, name, initialStatus, initialImages }: { id: string; name: string; initialStatus: string; initialImages: Img[]; }) {
  const [status, setStatus] = useState(initialStatus);
  const [images, setImages] = useState<Img[]>(initialImages);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/landings/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setStatus(data.project.status);
    setProgress(data.progress ?? 0);
    setImages(data.project.images.map((i: Img) => ({ id: i.id, slot: i.slot, type: i.type, status: i.status, url: i.url, error: i.error })));
  }, [id]);

  useEffect(() => {
    const active = status === 'QUEUED' || status === 'PROCESSING' || images.some((i) => i.status === 'PENDING' || i.status === 'PROCESSING');
    if (active) {
      timer.current = setInterval(poll, 2500);
      return () => { if (timer.current) clearInterval(timer.current); };
    }
  }, [status, images, poll]);

  async function regenerate(slot: number) {
    setImages((prev) => prev.map((i) => (i.slot === slot ? { ...i, status: 'PENDING', url: null, error: null } : i)));
    const res = await fetch(`/api/landings/${id}/regenerate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) });
    if (res.ok) { setStatus('PROCESSING'); poll(); }
    else toast({ variant: 'destructive', title: 'No se pudo regenerar' });
  }

  const completed = images.filter((i) => i.status === 'COMPLETED').length;
  const isActive = status === 'QUEUED' || status === 'PROCESSING';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="text-sm text-muted-foreground">{completed}/9 imágenes completadas</p>
        </div>
        <a href={`/api/landings/${id}/download`}>
          <Button disabled={completed === 0}><Download className="h-4 w-4" /> Descargar .zip</Button>
        </a>
      </div>

      {isActive && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
            <div className="flex-1">
              <p className="text-sm">Generando imágenes… {progress}%</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {images.map((img) => (
          <Card key={img.slot} className="overflow-hidden">
            <div className="relative flex aspect-[5/6] items-center justify-center bg-muted/30">
              {img.status === 'COMPLETED' && img.url ? (
                <img src={img.url} alt={img.type} className="h-full w-full object-cover" />
              ) : img.status === 'FAILED' ? (
                <div className="p-3 text-center text-xs text-destructive"><AlertTriangle className="mx-auto mb-1 h-5 w-5" />{img.error ?? 'Error'}</div>
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              )}
            </div>
            <CardContent className="flex items-center justify-between p-2">
              <div className="text-xs">
                <span className="font-medium">{img.slot}. {TITLES[img.type] ?? img.type}</span>
                <Badge variant={img.status === 'COMPLETED' ? 'green' : img.status === 'FAILED' ? 'destructive' : 'secondary'} className="ml-1">{img.status}</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => regenerate(img.slot)} title="Regenerar"><RefreshCw className="h-3.5 w-3.5" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
