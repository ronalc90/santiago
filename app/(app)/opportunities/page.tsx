import { prisma } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OpportunityBadge } from '@/components/shared/opportunity-badge';
import { DiscoverButton } from '@/components/opportunities/discover-button';
import { getDiscoveryStatus } from '@/lib/services/discovery';
import { getEnv } from '@/lib/config/env';

export const dynamic = 'force-dynamic';

const DROPI_LABEL: Record<string, string> = {
  DISPONIBLE: 'Dropi', NO_DISPONIBLE: 'No Dropi', A_IMPORTAR: 'A importar', DESCONOCIDO: '—',
};

export default async function OpportunitiesPage() {
  const env = getEnv();
  const [candidates, status] = await Promise.all([
    prisma.opportunityCandidate.findMany({
      where: { status: { not: 'DESCARTADO' } },
      orderBy: [{ score4x25: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
      include: { _count: { select: { creatives: true } } },
    }),
    getDiscoveryStatus(),
  ]);
  const paidActive = env.META_DISCOVERY === 'on' || env.TIKTOK_DISCOVERY === 'on';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Oportunidades</h1>
          <p className="text-sm text-muted-foreground">
            Productos candidatos descubiertos por las fuentes activas, ordenados por score 4×25.
            {env.DISCOVERY_MOCK ? ' (modo MOCK)' : ''}
          </p>
        </div>
        <DiscoverButton paidActive={paidActive} />
      </div>

      {status && (
        <p className="text-xs text-muted-foreground">
          Última corrida: <span className="font-medium">{status.candidates}</span> candidato(s) · fuentes: {status.sources.join(', ') || 'ninguna'}.
        </p>
      )}

      {candidates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Aún no hay candidatos. Pulsa «Buscar ahora» (o espera al descubrimiento diario).
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
                      {c.name}
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
