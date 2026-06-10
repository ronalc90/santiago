import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OpportunityBadge } from '@/components/shared/opportunity-badge';
import { NewProductDialog } from '@/components/products/new-product-dialog';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  DETECTADO: 'Detectado', VALIDADO: 'Validado', LANDING_CREADA: 'Landing creada', LANZADO: 'Lanzado', ESCALANDO: 'Escalando',
};
const DROPI_LABEL: Record<string, string> = {
  DISPONIBLE: 'Dropi', NO_DISPONIBLE: 'No Dropi', A_IMPORTAR: 'A importar', DESCONOCIDO: '—',
};

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { ads: true, landings: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">Cada producto une su data de spy, su landing, notas y estado.</p>
        </div>
        <NewProductDialog />
      </div>
      {products.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Aún no hay productos. Créalos con «Nuevo producto» o desde el detalle de un anuncio en el Spy.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`}>
              <Card className="transition-colors hover:bg-secondary/30">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p._count.ads} anuncio(s) · {p._count.landings} landing(s)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    {p.opportunityScore != null && (
                      <span className="text-sm font-semibold" title="Score de oportunidad">{Math.round(p.opportunityScore)}</span>
                    )}
                    <OpportunityBadge band={p.opportunityBand} />
                    <Badge variant="outline">{p.market}</Badge>
                    <Badge variant="secondary">{DROPI_LABEL[p.dropiAvailability]}</Badge>
                    <Badge>{STATUS_LABEL[p.status]}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
