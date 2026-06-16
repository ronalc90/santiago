import { SpyTable } from '@/components/spy/spy-table';
import { ImportDialog } from '@/components/spy/import-dialog';
import { SyncDialog } from '@/components/spy/sync-dialog';

export const dynamic = 'force-dynamic';

export default function SpyPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Spy de anuncios</h1>
          <p className="text-sm text-muted-foreground">Productos ganadores detectados, ordenados por Winner Score.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncDialog />
          <ImportDialog />
        </div>
      </div>
      <SpyTable />
    </div>
  );
}
