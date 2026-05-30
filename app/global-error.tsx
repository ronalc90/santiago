'use client';

/** Error global (App Router). Renderiza su propio html/body y evita el fallback a pages/_document. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="text-muted-foreground">Ocurrió un error inesperado.</p>
        <button
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
