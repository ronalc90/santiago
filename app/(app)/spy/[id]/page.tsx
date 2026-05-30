import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClassificationBadge } from '@/components/shared/classification-badge';
import { AdActions } from '@/components/spy/ad-actions';
import { CreativeImage } from '@/components/spy/creative-image';
import { formatDate } from '@/lib/utils';
import { normalizeAdLibraryUrl } from '@/lib/ad-library';

export const dynamic = 'force-dynamic';

export default async function AdDetailPage({ params }: { params: { id: string } }) {
  const ad = await prisma.ad.findUnique({ where: { id: params.id }, include: { store: true, product: true } });
  if (!ad) notFound();

  return (
    <div className="space-y-6">
      <Link href="/spy" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al spy
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{ad.storeName}</CardTitle>
                <ClassificationBadge value={ad.classification} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <Metric label="País" value={ad.country} />
                <Metric label="Días activos" value={String(ad.daysActive)} />
                <Metric label="Gasto est." value={ad.estimatedSpend > 0 ? `$${ad.estimatedSpend.toLocaleString()}` : '—'} />
                <Metric label="Winner Score" value={ad.winnerScore.toLocaleString()} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Copy del anuncio</p>
                <p className="rounded-md border bg-muted/30 p-3 text-sm">{ad.copyText || '—'}</p>
              </div>
              <a href={normalizeAdLibraryUrl(ad.adLibraryUrl, { query: ad.storeName, country: ad.country })} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-sky-400 hover:underline">
                <ExternalLink className="h-4 w-4" /> Ver en Meta Ad Library
              </a>
            </CardContent>
          </Card>

          {ad.creativeUrl && (
            <Card>
              <CardHeader><CardTitle>Creativo</CardTitle></CardHeader>
              <CardContent>
                <CreativeImage src={ad.creativeUrl} alt={`Creativo de ${ad.storeName}`} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Historial</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Detectado" value={formatDate(ad.detectedAt)} />
              <Row label="Primera vez" value={formatDate(ad.firstSeenAt)} />
              <Row label="Última vez" value={formatDate(ad.lastSeenAt)} />
              <Row label="Estado" value={ad.isNew ? 'Nuevo' : 'Histórico'} />
              <Row label="ad_id" value={ad.adId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Señales del negocio</CardTitle></CardHeader>
            <CardContent>
              <AdActions
                adId={ad.id}
                sellsInColombia={ad.sellsInColombia}
                hasUnusedForeignCreative={ad.hasUnusedForeignCreative}
                productId={ad.productId}
                productName={ad.product?.name ?? null}
                defaultProductName={ad.copyText?.slice(0, 60) ?? ad.storeName}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
