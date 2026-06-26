import Link from 'next/link';
import { Telescope, Package, ImageIcon, Store, Rocket, TrendingUp } from 'lucide-react';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClassificationBadge } from '@/components/shared/classification-badge';

export const dynamic = 'force-dynamic';

const PIPELINE_STAGES = [
  { key: 'DETECTADO', label: 'Detectado' },
  { key: 'VALIDADO', label: 'Validado' },
  { key: 'LANDING_CREADA', label: 'Landing creada' },
  { key: 'LANZADO', label: 'Lanzado' },
  { key: 'ESCALANDO', label: 'Escalando' },
];

export default async function DashboardPage() {
  const [adsDetected, adsNew, byStatus, landings, stores, byMarket, topAds] = await Promise.all([
    prisma.ad.count(),
    prisma.ad.count({ where: { isNew: true } }),
    prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.landingProject.count({ where: { status: 'COMPLETED' } }),
    prisma.store.count(),
    prisma.product.groupBy({ by: ['market'], _count: { _all: true } }),
    prisma.ad.findMany({
      orderBy: [
        { winnerScore: 'desc' },
        { daysActive: 'desc' },
        { estimatedSpend: 'desc' },
        { detectedAt: 'desc' },
        { id: 'desc' },
      ],
      take: 5,
      include: { store: true },
    }),
  ]);

  const pipeline: Record<string, number> = { DETECTADO: 0, VALIDADO: 0, LANDING_CREADA: 0, LANZADO: 0, ESCALANDO: 0 };
  for (const r of byStatus) pipeline[r.status] = r._count._all;
  const inAnalysis = pipeline.DETECTADO + pipeline.VALIDADO;
  const launched = pipeline.LANZADO + pipeline.ESCALANDO;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vista general del negocio.</p>
      </div>

      {adsDetected === 0 && landings === 0 && (
        <Card className="border-sky-500/40 bg-sky-500/5">
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold">🚀 Primeros pasos</p>
            <ol className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <li>
                <span className="font-medium text-foreground">1. Descubre productos:</span> trae anuncios reales en{' '}
                <Link href="/spy" className="text-sky-500 hover:underline">Spy</Link> o candidatos en{' '}
                <Link href="/opportunities" className="text-sky-500 hover:underline">Oportunidades</Link>.
              </li>
              <li>
                <span className="font-medium text-foreground">2. Conviértelos</span> en{' '}
                <Link href="/products" className="text-sky-500 hover:underline">Mis productos</Link> y revisa su puntaje y margen.
              </li>
              <li>
                <span className="font-medium text-foreground">3. Crea la</span>{' '}
                <Link href="/landings" className="text-sky-500 hover:underline">landing</Link> con IA y publícala en Shopify.
              </li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">¿Dudas? Abre la <Link href="/ayuda" className="underline">Guía</Link>.</p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={<Telescope className="h-4 w-4" />} label="Anuncios detectados" value={adsDetected} hint={`${adsNew} nuevos`} />
        <Kpi icon={<Package className="h-4 w-4" />} label="En análisis" value={inAnalysis} />
        <Kpi icon={<Rocket className="h-4 w-4" />} label="Lanzados" value={launched} />
        <Kpi icon={<ImageIcon className="h-4 w-4" />} label="Landings generadas" value={landings} />
        <Kpi icon={<Store className="h-4 w-4" />} label="Tiendas monitoreadas" value={stores} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Mercados" value={byMarket.length} />
      </div>

      {/* Pipeline */}
      <Card>
        <CardHeader><CardTitle>Pipeline de producto</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div className="w-full rounded-lg border bg-muted/30 p-3 text-center sm:w-auto sm:min-w-[120px] sm:p-4">
                  <div className="text-2xl font-bold">{pipeline[stage.key]}</div>
                  <div className="text-xs text-muted-foreground">{stage.label}</div>
                </div>
                {i < PIPELINE_STAGES.length - 1 && <span className="hidden text-muted-foreground sm:inline">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top winners */}
        <Card>
          <CardHeader><CardTitle>Top 5 por Winner Score</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topAds.length === 0 && <p className="text-sm text-muted-foreground">Sin datos. Importa resultados del spy.</p>}
            {topAds.map((ad) => (
              <Link key={ad.id} href={`/spy/${ad.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-secondary/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ad.storeName}</p>
                  <p className="truncate text-xs text-muted-foreground">{ad.copyText}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <span className="text-sm font-semibold">
                    {ad.winnerScore.toLocaleString()}
                    <span className="ml-1 font-normal text-muted-foreground">· {ad.daysActive}d</span>
                  </span>
                  <ClassificationBadge value={ad.classification} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Mercados */}
        <Card>
          <CardHeader><CardTitle>Productos por mercado</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byMarket.length === 0 && <p className="text-sm text-muted-foreground">Sin productos todavía.</p>}
            {byMarket.map((m) => (
              <div key={m.market} className="flex min-w-0 items-center justify-between gap-2 rounded-md border p-3">
                <span className="truncate text-sm font-medium">{m.market}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{m._count._all} producto(s)</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
        <div className="mt-2 text-3xl font-bold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
