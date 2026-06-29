import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LANDING_STATUS as STATUS } from '@/lib/landings/labels';

export const dynamic = 'force-dynamic';

export default async function LandingsPage() {
  const landings = await prisma.landingProject.findMany({
    orderBy: { createdAt: 'desc' },
    include: { product: true, _count: { select: { images: true } } },
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Landings</h1>
          <p className="text-sm text-muted-foreground">Proyectos de páginas de venta generadas con IA (9 imágenes c/u).</p>
        </div>
        <Link href="/landings/new"><Button><Plus className="h-4 w-4" /> Nueva landing</Button></Link>
      </div>
      {landings.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center text-muted-foreground">
            <p>Aún no has creado ninguna página de venta.</p>
            <p className="text-sm">Crea una con IA (9 imágenes + HTML) desde cero, o desde el detalle de un producto.</p>
            <Link href="/landings/new" className="inline-block"><Button><Plus className="h-4 w-4" /> Crear mi primera landing</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {landings.map((l) => {
            const st = STATUS[l.status];
            return (
              <Link key={l.id} href={`/landings/${l.id}`}>
                <Card className="transition-colors hover:bg-secondary/30">
                  <CardContent className="flex items-center justify-between gap-2 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.product.name} · {l._count.images} imágenes</p>
                    </div>
                    <Badge variant={st.variant} className="shrink-0">{st.label}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
