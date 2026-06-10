'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw, Loader2, AlertTriangle, ZoomIn, Trash2, ShoppingBag, Upload, Store, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';

interface Img { id: string; slot: number; type: string; status: string; url: string | null; error: string | null; }
const TITLES: Record<string, string> = {
  hero: 'Hero', precio: 'Precio', antes_despues: 'Antes/Después', modo_uso: 'Modo de uso',
  beneficios: 'Beneficios', ficha: 'Ficha técnica', garantia: 'Garantía', urgencia: 'Urgencia', testimonios: 'Testimonios',
};

export function LandingDetail({ id, name, initialStatus, initialError, initialImages, shopifyProductId, shopifyAdminUrl, canPublishShopify }: { id: string; name: string; initialStatus: string; initialError?: string | null; initialImages: Img[]; shopifyProductId?: string | null; shopifyAdminUrl?: string | null; canPublishShopify?: boolean; }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [images, setImages] = useState<Img[]>(initialImages);
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenAllOpen, setRegenAllOpen] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(shopifyAdminUrl ?? null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/landings/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setStatus(data.project.status);
    setError(data.project.error ?? null);
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

  // Hidrata el error/estado del proyecto al montar. El polling solo corre mientras
  // la landing está activa, así que para una landing ya FAILED esta carga garantiza
  // que el mensaje de error del proyecto esté disponible para el banner. `poll` es
  // estable (memoizado por id) y la carga es idempotente.
  useEffect(() => {
    if (initialError === undefined) void poll();
  }, [initialError, poll]);

  async function regenerate(slot: number) {
    setImages((prev) => prev.map((i) => (i.slot === slot ? { ...i, status: 'PENDING', url: null, error: null } : i)));
    const res = await fetch(`/api/landings/${id}/regenerate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) });
    if (res.ok) { setStatus('PROCESSING'); poll(); }
    else toast({ variant: 'destructive', title: 'No se pudo regenerar' });
  }

  async function regenerateAll() {
    if (regeneratingAll) return;
    setRegeneratingAll(true);
    const res = await fetch(`/api/landings/${id}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    setRegeneratingAll(false);
    setRegenAllOpen(false);
    if (res.ok) {
      setStatus('PROCESSING');
      setImages((prev) => prev.map((i) => ({ ...i, status: 'PENDING', url: null, error: null })));
      poll();
    } else {
      toast({ variant: 'destructive', title: 'No se pudo regenerar' });
    }
  }

  async function publishToShopify() {
    if (publishing) return;
    setPublishing(true);
    const res = await fetch(`/api/landings/${id}/shopify/publish`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setPublishing(false);
    setPublishOpen(false);
    if (res.ok) {
      setPublishedUrl(data.adminUrl ?? null);
      toast({
        title: data.alreadyPublished ? 'Ya estaba publicado en Shopify' : 'Producto publicado en Shopify',
        description:
          data.status === 'active'
            ? 'Quedó ACTIVO en tu tienda. Revísalo con "Ver en Shopify".'
            : 'Quedó como borrador. Usa "Ver en Shopify" para revisarlo y publicarlo.',
      });
    } else {
      toast({ variant: 'destructive', title: 'No se pudo publicar', description: data.error });
    }
  }

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const res = await fetch(`/api/landings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Landing eliminada' });
      router.push('/landings');
      router.refresh();
    } else {
      setDeleting(false);
      setConfirmOpen(false);
      toast({ variant: 'destructive', title: 'No se pudo eliminar' });
    }
  }

  const completed = images.filter((i) => i.status === 'COMPLETED').length;
  const isActive = status === 'QUEUED' || status === 'PROCESSING';
  const isFailed = status === 'FAILED';

  // Solo las imágenes generadas se pueden visualizar en el visor.
  const gallery = images.filter(
    (i): i is Img & { url: string } => i.status === 'COMPLETED' && Boolean(i.url),
  );
  const lightboxImages = gallery.map((i) => ({ url: i.url, alt: TITLES[i.type] ?? i.type }));
  const openLightbox = (slot: number) => {
    const position = gallery.findIndex((i) => i.slot === slot);
    if (position >= 0) setActiveIndex(position);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{name}</h1>
            <Badge variant={status === 'COMPLETED' ? 'green' : isFailed ? 'destructive' : 'secondary'}>{status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{completed}/9 imágenes completadas</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <a href={`/api/landings/${id}/download`}>
            <Button disabled={completed === 0}><Download className="h-4 w-4" /> Descargar .zip</Button>
          </a>
          <a href={`/api/landings/${id}/html`} target="_blank" rel="noreferrer">
            <Button variant="outline" disabled={completed === 0} title="Ver la landing HTML de ventas (conversión + SEO)">
              <Globe className="h-4 w-4" /> Landing HTML
            </Button>
          </a>
          <a href={`/api/landings/${id}/shopify`}>
            <Button variant="outline" disabled={completed === 0} title="Exportar un CSV para importar el producto en Shopify">
              <ShoppingBag className="h-4 w-4" /> Exportar a Shopify
            </Button>
          </a>
          {publishedUrl ? (
            <a href={publishedUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" title="Abrir el producto en Shopify"><Store className="h-4 w-4" /> Ver en Shopify</Button>
            </a>
          ) : (
            <Button
              variant="outline"
              onClick={() => setPublishOpen(true)}
              disabled={completed === 0 || publishing || !canPublishShopify}
              title={canPublishShopify ? 'Crear el producto en tu tienda Shopify' : 'Configura Shopify (y un almacenamiento https) para publicar'}
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Publicar en Shopify
            </Button>
          )}
          <Button variant="outline" onClick={() => setRegenAllOpen(true)} disabled={isActive || regeneratingAll} title="Regenerar las 9 imágenes">
            {regeneratingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerar todas
          </Button>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={deleting} title="Eliminar landing">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Eliminar
          </Button>
        </div>
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

      {isFailed && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">La generación de la landing falló</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error ?? 'Ocurrió un error al generar las imágenes.'}
                {completed > 0
                  ? ' Puedes regenerar las imágenes con error o eliminar la landing.'
                  : ' Puedes regenerar las imágenes o eliminar la landing y crear una nueva.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {images.map((img) => (
          <Card key={img.slot} className="overflow-hidden">
            <div className="relative flex aspect-[5/6] items-center justify-center bg-muted/30">
              {img.status === 'COMPLETED' && img.url ? (
                <button
                  type="button"
                  onClick={() => openLightbox(img.slot)}
                  aria-label={`Ampliar ${TITLES[img.type] ?? img.type}`}
                  className="group absolute inset-0 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img src={img.url} alt={img.type} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                    <ZoomIn className="h-7 w-7 text-white drop-shadow" />
                  </span>
                </button>
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

      <ImageLightbox
        images={lightboxImages}
        index={activeIndex}
        onClose={() => setActiveIndex(null)}
        onNavigate={setActiveIndex}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar landing"
        description="Se eliminarán esta landing y todas sus imágenes. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        loading={deleting}
        onConfirm={remove}
      />

      <ConfirmDialog
        open={regenAllOpen}
        onOpenChange={setRegenAllOpen}
        title="Regenerar las 9 imágenes"
        description="Se volverán a generar las 9 imágenes con IA (consume créditos de Gemini). Las imágenes actuales se reemplazarán."
        confirmLabel="Regenerar todas"
        loading={regeneratingAll}
        onConfirm={regenerateAll}
      />

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publicar en Shopify"
        description="Se creará un producto NUEVO en tu tienda Shopify con las imágenes y el copy de esta landing. Es una acción sobre tu tienda real."
        confirmLabel="Publicar"
        loading={publishing}
        onConfirm={publishToShopify}
      />
    </div>
  );
}
