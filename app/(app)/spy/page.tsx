import { SpyTable } from '@/components/spy/spy-table';
import { ImportDialog } from '@/components/spy/import-dialog';
import { SyncButton } from '@/components/spy/sync-button';

export const dynamic = 'force-dynamic';

export default function SpyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Spy de anuncios</h1>
          <p className="text-sm text-muted-foreground">Productos ganadores detectados, ordenados por Winner Score.</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <ImportDialog />
        </div>
      </div>
      <SpyTable />
    </div>
  );
}
