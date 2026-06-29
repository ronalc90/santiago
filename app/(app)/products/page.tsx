import Link from 'next/link';
import { ImageIcon } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OpportunityBadge } from '@/components/shared/opportunity-badge';
import { NewProductDialog } from '@/components/products/new-product-dialog';
import { MeliSaturationButton } from '@/components/products/meli-saturation-button';
import { getMeliConnection } from '@/lib/services/meli';
import { PRODUCT_STATUS_LABEL as STATUS_LABEL, DROPI_BADGE_LABEL as DROPI_LABEL } from '@/lib/products/labels';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const [products, meli] = await Promise.all([
    prisma.product.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { ads: true, landings: true } },
        landings: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true } },
      },
    }),
    getMeliConnection(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">Cada producto une su data de spy, su landing, notas y estado.</p>
        </div>
        <div className="flex items-center gap-2">
          {meli.connected && !meli.needsReconnect && <MeliSaturationButton />}
          <NewProductDialog />
        </div>
      </div>
      {products.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Aún no hay productos. Créalos con «Nuevo producto» o desde el detalle de un anuncio en el Spy.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {products.map((p) => {
            const landing = p.landings[0];
            return (
              <Card key={p.id} className="transition-colors hover:bg-secondary/30">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/products/${p.id}`} className="truncate font-medium hover:underline">{p.name}</Link>
                    <p className="text-xs text-muted-foreground">{p._count.ads} anuncio(s) · {p._count.landings} landing(s)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    {p.opportunityScore != null && (
                      <span className="text-sm font-semibold" title="Score de oportunidad">{Math.round(p.opportunityScore)}</span>
                    )}
                    {(() => {
                      const cascade = (p.opportunityBreakdown as { cascade?: { score?: number | null } } | null)?.cascade?.score;
                      return cascade != null && cascade >= 60 ? (
                        <Badge variant="green" title="Winner global que aún no llega a CO: ventana para entrar primero">
                          🌊 {cascade}
                        </Badge>
                      ) : null;
                    })()}
                    {p.realRoas != null && (
                      <Badge
                        variant={p.realRoas >= 1.5 ? 'green' : p.realRoas < 1 ? 'red' : 'yellow'}
                        title={`Resultado real: ROAS ${p.realRoas}`}
                      >
                        {p.realRoas >= 1.5 ? '✅ validado' : p.realRoas < 1 ? '❌ pierde' : '⚠️ marginal'}
                      </Badge>
                    )}
                    <OpportunityBadge band={p.opportunityBand} />
                    <Badge variant="outline">{p.market}</Badge>
                    <Badge variant="secondary">{DROPI_LABEL[p.dropiAvailability]}</Badge>
                    <Badge>{STATUS_LABEL[p.status]}</Badge>
                    {landing && (
                      <Link
                        href={`/landings/${landing.id}`}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-secondary"
                        title={landing.status === 'COMPLETED' ? 'Ver la landing generada' : 'Ver la landing (en progreso)'}
                      >
                        <ImageIcon className="h-3.5 w-3.5" /> Ver landing
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
