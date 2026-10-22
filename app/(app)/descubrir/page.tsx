import { SpyTable } from '@/components/spy/spy-table';
import { ImportDialog } from '@/components/spy/import-dialog';
import { SyncDialog } from '@/components/spy/sync-dialog';
import { DiscoverTabs, type DiscoverView } from '@/components/descubrir/discover-tabs';
import { OpportunitiesView, type OpportunitiesSearchParams } from '@/components/opportunities/opportunities-view';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Descubrir' };

interface SP extends OpportunitiesSearchParams {
  vista?: string;
}

/**
 * «Descubrir»: único punto de entrada para encontrar el próximo producto. Reúne
 * los dos motores en pestañas para que quede claro cuándo usar cada uno:
 *  - Anuncios ganadores: lo que YA se está vendiendo en ads (Winner Score).
 *  - Oportunidades: lo que el sistema te PROPONE (score 4×25 + Dropi).
 * Cada explicación vive dentro de su propia pestaña; el header solo orienta.
 */
export default async function DescubrirPage(props: { searchParams: Promise<SP> }) {
  const searchParams = await props.searchParams;
  const vista: DiscoverView = searchParams.vista === 'oportunidades' ? 'oportunidades' : 'anuncios';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Descubrir</h1>
        <p className="text-sm text-muted-foreground">Encuentra tu próximo producto ganador. Elige cómo quieres buscarlo:</p>
      </div>

      <DiscoverTabs current={vista} />

      {vista === 'anuncios' ? (
        <section className="space-y-4" aria-labelledby="descubrir-anuncios">
          <h2 id="descubrir-anuncios" className="sr-only">Anuncios ganadores</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-2xl text-sm text-muted-foreground">
              Anuncios activos detectados y ordenados por <span className="font-medium text-foreground">Winner Score</span>.
              Úsalo cuando quieres partir de algo que <span className="font-medium text-foreground">ya se está vendiendo</span> en
              publicidad y convertirlo en tu producto.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <SyncDialog />
              <ImportDialog />
            </div>
          </div>
          <SpyTable />
        </section>
      ) : (
        <OpportunitiesView searchParams={searchParams} />
      )}
    </div>
  );
}
