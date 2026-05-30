import { prisma } from '@/lib/db';
import { LandingWizard } from '@/components/landings/landing-wizard';

export const dynamic = 'force-dynamic';

export default async function NewLandingPage({ searchParams }: { searchParams: { productId?: string } }) {
  const products = await prisma.product.findMany({ orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, market: true, currency: true } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva landing</h1>
        <p className="text-sm text-muted-foreground">Completa los datos del producto y el estilo. Generaremos 9 imágenes en español.</p>
      </div>
      <LandingWizard products={products} defaultProductId={searchParams.productId} />
    </div>
  );
}
