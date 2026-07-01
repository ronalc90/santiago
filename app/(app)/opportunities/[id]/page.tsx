import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { prisma } from '@/lib/db';
import { dropiPanelSearchUrl } from '@/lib/integrations/dropi-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OpportunityBadge } from '@/components/shared/opportunity-badge';
import { ConvertButton } from '@/components/opportunities/convert-button';

export const dynamic = 'force-dynamic';

export default async function OpportunityDetail({ params }: { params: { id: string } }) {
  const c = await prisma.opportunityCandidate.findUnique({
    where: { id: params.id },
    include: { creatives: true },
  });
  if (!c) notFound();

  const metric = (label: string, value: string | number | null | undefined) =>
    value == null || value === '' ? null : (
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium">{value}</dd>
      </div>
    );

  return (
    <div className="space-y-6">
      <Link href="/opportunities" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a Oportunidades
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {c.score4x25 != null && <span className="text-sm font-semibold">Score {Math.round(c.score4x25)}</span>}
            <OpportunityBadge band={c.scoreBand} />
            {c.enCO ? <Badge variant="green">en CO{c.saturationCO != null ? ` · ${c.saturationCO}` : ''}</Badge> : <Badge variant="gray">no CO</Badge>}
            <a href={dropiPanelSearchUrl(c.name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" title="Buscar este producto en tu panel de Dropi">
              {c.dropiStatus === 'DISPONIBLE' ? (
                <Badge variant="green">Dropi</Badge>
              ) : (
                <span className="text-xs text-muted-foreground hover:text-foreground">buscar en Dropi</span>
              )}
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </div>
        </div>
        <ConvertButton id={c.id} productId={c.productId} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Señales</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metric('Categoría', c.category)}
            {metric('Países', c.countries.join(', '))}
            {metric('Fuentes', c.sources.join(', '))}
            {metric('Interés (Trends)', c.interest)}
            {metric('Ventas', c.salesCount)}
            {metric('Publicaciones', c.listingsCount)}
            {metric('Días activo', c.daysActive)}
            {metric('Saturación CO', c.saturationCO)}
            {metric('Dropi ref', c.dropiRef)}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Creativos ({c.creatives.length})</CardTitle></CardHeader>
        <CardContent>
          {c.creatives.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin creativos. (Las fuentes Meta/TikTok los traen; ML/Trends no.)</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {c.creatives.map((cr) =>
                cr.type === 'video' ? (
                  <video key={cr.id} src={cr.url} controls className="aspect-square w-full rounded-md border object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={cr.id} src={cr.url} alt={c.name} className="aspect-square w-full rounded-md border object-cover" />
                ),
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
