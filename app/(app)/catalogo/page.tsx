import { CatalogTable } from '@/components/catalogo/catalog-table';
import { requireUser } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

export default async function CatalogoPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogo Dropi</h1>
        <p className="text-sm text-muted-foreground">
          Los productos de Dropi que importaste por CSV. Búscalos, fíltralos por categoría y ordénalos por costo; cada uno abre tu panel de Dropi.
        </p>
      </div>
      <CatalogTable />
    </div>
  );
}
