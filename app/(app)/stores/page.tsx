import { prisma } from '@/lib/db';
import { StoresManager } from '@/components/stores/stores-manager';

export const dynamic = 'force-dynamic';

export default async function StoresPage() {
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { ads: true } } },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tiendas competidoras</h1>
        <p className="text-sm text-muted-foreground">Tiendas que monitoreas en Meta Ad Library.</p>
      </div>
      <StoresManager initial={stores.map((s) => ({ id: s.id, name: s.name, country: s.country, adLibraryUrl: s.adLibraryUrl ?? '', notes: s.notes ?? '', adsCount: s._count.ads }))} />
    </div>
  );
}
