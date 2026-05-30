'use client';
import { useState } from 'react';

const VIDEO_RE = /\.(mp4|webm|mov)(\?|$)/i;

/**
 * Muestra el creativo del anuncio (imagen o video). Si la URL no carga (las
 * URLs de CDN de Meta expiran), degrada a un aviso en lugar de un media roto.
 * Tras la ingesta real el `src` apunta a NUESTRO almacenamiento (permanente).
 */
export function CreativeImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-64 w-full max-w-md flex-col items-center justify-center gap-1 rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        <p>No se pudo cargar el creativo.</p>
        <p className="text-xs">La URL pudo expirar; vuelve a sincronizar o ábrelo en la Ad Library.</p>
      </div>
    );
  }

  if (VIDEO_RE.test(src)) {
    return (
      <video
        src={src}
        controls
        playsInline
        onError={() => setFailed(true)}
        className="max-h-96 rounded-md border"
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="max-h-96 rounded-md border"
    />
  );
}
