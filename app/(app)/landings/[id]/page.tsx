import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { LandingDetail } from '@/components/landings/landing-detail';
import { shopifyAdminUrlFor, canPublishToShopify } from '@/lib/shopify/client';

export const dynamic = 'force-dynamic';

export default async function LandingDetailPage({ params }: { params: { id: string } }) {
  const project = await prisma.landingProject.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { slot: 'asc' } }, product: true },
  });
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/products/${project.productId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {project.product.name}
      </Link>
      <LandingDetail
        id={project.id}
        name={project.name}
        initialStatus={project.status}
        initialImages={project.images.map((i) => ({ id: i.id, slot: i.slot, type: i.type, status: i.status, url: i.url, error: i.error }))}
        shopifyProductId={project.shopifyProductId}
        shopifyAdminUrl={project.shopifyProductId ? shopifyAdminUrlFor(project.shopifyProductId) : null}
        canPublishShopify={canPublishToShopify()}
      />
    </div>
  );
}
