import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus, ExternalLink } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClassificationBadge } from '@/components/shared/classification-badge';
import { ProductManager } from '@/components/products/product-manager';
import { OpportunityCard } from '@/components/products/opportunity-card';
import { normalizeAdLibraryUrl } from '@/lib/ad-library';

export const dynamic = 'force-dynamic';

const LANDING_STATUS: Record<string, string> = {
  DRAFT: 'Borrador', QUEUED: 'En cola', PROCESSING: 'Generando', COMPLETED: 'Completada', FAILED: 'Fallida',
};

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { ads: { include: { store: true } }, landings: { include: { _count: { select: { images: true } } }, orderBy: { createdAt: 'desc' } } },
  });
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Link href="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a productos
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader><CardTitle>{product.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">{product.description || 'Sin descripción.'}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Landings</CardTitle>
                <Link href={`/landings/new?productId=${product.id}`}>
                  <Button size="sm"><Plus className="h-4 w-4" /> Nueva landing</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {product.landings.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay landings para este producto.</p>}
              {product.landings.map((l) => (
                <Link key={l.id} href={`/landings/${l.id}`} className="flex items-center justify-between gap-2 rounded-md border p-3 hover:bg-secondary/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l._count.images} imágenes</p>
                  </div>
                  <Badge variant={l.status === 'COMPLETED' ? 'green' : l.status === 'FAILED' ? 'destructive' : 'secondary'} className="shrink-0">{LANDING_STATUS[l.status]}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Anuncios ligados (Spy)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {product.ads.length === 0 && <p className="text-sm text-muted-foreground">Sin anuncios ligados.</p>}
              {product.ads.map((ad) => (
                <div key={ad.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{ad.storeName} · {ad.country}</p>
                    <p className="truncate text-xs text-muted-foreground">{ad.copyText}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ClassificationBadge value={ad.classification} />
                    <a href={normalizeAdLibraryUrl(ad.adLibraryUrl, { query: ad.storeName, country: ad.country })} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 text-muted-foreground" /></a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <OpportunityCard
            productId={product.id}
            initial={{
              score: product.opportunityScore,
              band: product.opportunityBand,
              confidence: product.opportunityConfidence,
              estimated: product.opportunityEstimated,
              breakdown: product.opportunityBreakdown as {
                coverage?: number;
                dimensions?: Record<string, { score: number | null; estimated: boolean; reasons?: string[] }>;
              } | null,
            }}
          />
          <ProductManager
            product={{
              id: product.id,
              status: product.status,
              market: product.market,
              currency: product.currency,
              sellsInColombia: product.sellsInColombia,
              hasUnusedForeignCreative: product.hasUnusedForeignCreative,
              dropiAvailability: product.dropiAvailability,
              notes: product.notes ?? '',
            }}
          />
        </div>
      </div>
    </div>
  );
}
