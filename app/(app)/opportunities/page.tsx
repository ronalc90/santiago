import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OpportunityBadge } from '@/components/shared/opportunity-badge';
import { DiscoverButton } from '@/components/opportunities/discover-button';
import { OpportunityFilters } from '@/components/opportunities/filters';
import { getDiscoveryStatus } from '@/lib/services/discovery';
import { getEnv } from '@/lib/config/env';

export const dynamic = 'force-dynamic';

const DROPI_LABEL: Record<string, string> = {
  DISPONIBLE: 'Dropi', NO_DISPONIBLE: 'No Dropi', A_IMPORTAR: 'A importar', DESCONOCIDO: '—',
};

interface SP {
  noCO?: string;
  dropi?: string;
  creativos?: string;
  fuente?: string;
}

export default async function OpportunitiesPage({ searchParams }: { searchParams: SP }) {
  const env = getEnv();
  const where: Prisma.OpportunityCandidateWhereInput = { status: { not: 'DESCARTADO' } };
  if (searchParams.noCO) where.enCO = false;
  if (searchParams.dropi) where.dropiStatus = 'DISPONIBLE';
  if (searchParams.creativos) where.creatives = { some: {} };
  const VALID_SOURCES = ['mercadolibre', 'trends', 'meta', 'tiktok', 'mock'];
  if (searchParams.fuente && VALID_SOURCES.includes(searchParams.fuente)) where.sources = { has: searchParams.fuente };

  const [candidates, status, dropiCatalogCount] = await Promise.all([
    prisma.opportunityCandidate.findMany({
      where,
      orderBy: [{ score4x25: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
      include: { _count: { select: { creatives: true } } },
    }),
    getDiscoveryStatus(),
    prisma.dropiCatalogItem.count(),
  ]);
  const noDropiCatalog = dropiCatalogCount === 0;
  const paidActive = env.META_DISCOVERY === 'on' || env.TIKTOK_DISCOVERY === 'on';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Oportunidades</h1>
          <p className="text-sm text-muted-foreground">
            Candidatos descubiertos por las fuentes activas, ordenados por score 4×25.{env.DISCOVERY_MOCK ? ' (modo MOCK)' : ''}
          </p>
        </div>
        <DiscoverButton paidActive={paidActive} />
      </div>

      <OpportunityFilters />

      {status && (
        <p className="text-xs text-muted-foreground">
          Última corrida: <span className="font-medium">{status.candidates}</span> candidato(s) · fuentes: {status.sources.join(', ') || 'ninguna'}
          {status.dropiMatched ? ` · ${status.dropiMatched} con Dropi` : ''}
          {status.embeddingsFailed ? ' · ⚠️ dedupe por embeddings no disponible' : ''}
          {status.warning ? ` · ⚠️ ${status.warning}` : ''}.
        </p>
      )}

      {noDropiCatalog && (
        <p className="rounded-md border border-dashed bg-secondary/30 p-3 text-xs text-muted-foreground">
          ⚠️ Aún no has importado el catálogo Dropi, por eso la columna «Dropi» sale en «—» y el filtro «Con Dropi» no muestra nada.
          Impórtalo en <Link href="/settings" className="font-medium underline">Ajustes → Descubrimiento → Catálogo Dropi (CSV)</Link> para cruzar los candidatos.
        </p>
      )}

      {candidates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {searchParams.dropi && noDropiCatalog
              ? 'No hay candidatos «Con Dropi» porque aún no importas el catálogo Dropi (Ajustes → Descubrimiento → Catálogo Dropi CSV). Sin catálogo, nada se marca como disponible.'
              : 'No hay candidatos con esos filtros. Pulsa «Buscar ahora» (o espera al descubrimiento diario).'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Países</TableHead>
                  <TableHead>Fuentes</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>CO</TableHead>
                  <TableHead>Dropi</TableHead>
                  <TableHead>Creativos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/opportunities/${c.id}`} className="hover:underline">{c.name}</Link>
                      {c.category && <span className="block text-xs text-muted-foreground">{c.category}</span>}
                    </TableCell>
                    <TableCell className="text-xs">{c.countries.join(', ')}</TableCell>
                    <TableCell className="text-xs">{c.sources.join(', ')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {c.score4x25 != null && <span className="text-sm font-semibold">{Math.round(c.score4x25)}</span>}
                        <OpportunityBadge band={c.scoreBand} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.enCO ? (
                        <Badge variant="green">en CO{c.saturationCO != null ? ` · ${c.saturationCO}` : ''}</Badge>
                      ) : (
                        <Badge variant="gray">no CO</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.dropiStatus === 'DISPONIBLE' ? 'green' : c.dropiStatus === 'A_IMPORTAR' ? 'yellow' : 'gray'}>
                        {DROPI_LABEL[c.dropiStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{c._count.creatives}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
