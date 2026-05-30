'use client';
import { useState } from 'react';

const VIDEO_RE = /\.(mp4|webm|mov)(\?|$)/i;
/** Hosts usados para creativos ficticios/demo (no son del anunciante real). */
const DEMO_CREATIVE_HOSTS = ['placehold.co', 'picsum.photos'];

/** true si el src es un placeholder de demostración (host conocido). */
function isDemoCreative(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase();
    return DEMO_CREATIVE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Muestra el creativo del anuncio (imagen o video). Si la URL no carga (las
 * URLs de CDN de Meta expiran), degrada a un aviso en lugar de un media roto.
 * Tras la ingesta real el `src` apunta a NUESTRO almacenamiento (permanente).
 * Si el `src` es un placeholder de demo, lo etiqueta para distinguirlo de un
 * creativo real.
 */
export function CreativeImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const demo = isDemoCreative(src);

  if (failed) {
    return (
      <div className="flex h-64 w-full max-w-md flex-col items-center justify-center gap-1 rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        <p>No se pudo cargar el creativo.</p>
        <p className="text-xs">La URL pudo expirar; vuelve a sincronizar o ábrelo en la Ad Library.</p>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {demo && (
        <span className="absolute left-2 top-2 z-10 rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-100">
          creativo de demostración
        </span>
      )}
      {VIDEO_RE.test(src) ? (
        <video
          src={src}
          controls
          playsInline
          onError={() => setFailed(true)}
          className="max-h-96 rounded-md border"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="max-h-96 rounded-md border"
        />
      )}
    </div>
  );
}
