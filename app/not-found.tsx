import Link from 'next/link';

/** Página 404 propia (App Router). Evita el fallback a pages/_document en el build. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">La página que buscas no existe.</p>
      <Link href="/dashboard" className="text-primary underline underline-offset-4">
        Volver al dashboard
      </Link>
    </div>
  );
}
