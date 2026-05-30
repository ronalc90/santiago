import { SpyTable } from '@/components/spy/spy-table';
import { ImportDialog } from '@/components/spy/import-dialog';

export const dynamic = 'force-dynamic';

export default function SpyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Spy de anuncios</h1>
          <p className="text-sm text-muted-foreground">Productos ganadores detectados, ordenados por Winner Score.</p>
        </div>
        <ImportDialog />
      </div>
      <SpyTable />
    </div>
  );
}
