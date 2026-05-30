'use client';
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxImage {
  url: string;
  alt?: string;
}

interface ImageLightboxProps {
  /** Imágenes que se pueden visualizar a pantalla completa. */
  images: LightboxImage[];
  /** Índice de la imagen activa; `null` mantiene el visor cerrado. */
  index: number | null;
  /** Cierra el visor. */
  onClose: () => void;
  /** Cambia la imagen activa (navegación entre imágenes). */
  onNavigate: (index: number) => void;
}

const controlClasses =
  'flex items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70';

/**
 * Visor de imágenes a pantalla completa (lightbox).
 *
 * Muestra la imagen completa sin recortarla (`object-contain`), se cierra con
 * Escape, el botón de cierre o haciendo clic en el fondo, y permite navegar
 * entre imágenes con las flechas del teclado o los controles laterales.
 */
export function ImageLightbox({ images, index, onClose, onNavigate }: ImageLightboxProps) {
  const total = images.length;
  const open = index !== null && index >= 0 && index < total;

  const goTo = React.useCallback(
    (next: number) => {
      if (total === 0) return;
      onNavigate((next + total) % total);
    },
    [total, onNavigate],
  );

  React.useEffect(() => {
    if (!open || index === null) return;
    const currentIndex = index;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goTo(currentIndex + 1);
      else if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, goTo]);

  const hasMultiple = total > 1;
  const current = index !== null ? images[index] : undefined;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center border-0 bg-transparent p-4 shadow-none outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:p-12"
        >
          <DialogPrimitive.Title className="sr-only">Visor de imágenes</DialogPrimitive.Title>

          {current && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={current.url}
              alt={current.alt ?? `Imagen ${(index ?? 0) + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
            />
          )}

          <DialogPrimitive.Close aria-label="Cerrar" className={`${controlClasses} absolute right-4 top-4 h-10 w-10`}>
            <X className="h-5 w-5" />
          </DialogPrimitive.Close>

          {hasMultiple && index !== null && (
            <>
              <div className="absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white backdrop-blur">
                {index + 1} / {total}
              </div>
              <button
                type="button"
                aria-label="Imagen anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(index - 1);
                }}
                className={`${controlClasses} absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 sm:left-4`}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                aria-label="Imagen siguiente"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(index + 1);
                }}
                className={`${controlClasses} absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 sm:right-4`}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
