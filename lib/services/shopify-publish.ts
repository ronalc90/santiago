import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config/env';
import type { LandingInputs } from '@/lib/services/landing-spec';
import { buildShopifyProduct, landingImagesFromProject } from '@/lib/services/shopify-export';
import { ShopifyClient, ShopifyApiError, isShopifyConfigured } from '@/lib/shopify/client';
import type { CreatedShopifyProduct } from '@/lib/shopify/client';

/**
 * Publica una landing como producto de Shopify (Admin API). Reutiliza
 * `buildShopifyProduct` (no duplica el armado) y es idempotente: si la landing ya
 * tiene `shopifyProductId`, no crea un producto nuevo.
 *
 * Anti-duplicado: se toma un "claim" atómico (shopifyPublishingAt) ANTES de llamar
 * a Shopify, así dos requests concurrentes no crean dos productos. El claim expira
 * (staleness) y se libera si la llamada falla, para no bloquear la landing.
 */

export class ShopifyNotConfiguredError extends Error {}
export class LandingNotFoundError extends Error {}
export class NoCompletedImagesError extends Error {}
export class PublishInProgressError extends Error {}
export { ShopifyApiError };

/** Ventana tras la cual un claim de publicación se considera abandonado. */
const CLAIM_STALE_MS = 2 * 60 * 1000;

export interface PublishResult {
  productId: string;
  handle: string;
  adminUrl: string;
  alreadyPublished: boolean;
  /** Estado con el que se creó/quedó el producto en Shopify. */
  status: 'draft' | 'active';
}

function adminUrl(domain: string, productId: string): string {
  return `https://${domain}/admin/products/${productId}`;
}

export async function publishLandingToShopify(projectId: string): Promise<PublishResult> {
  if (!isShopifyConfigured()) {
    throw new ShopifyNotConfiguredError('La publicación en Shopify no está configurada.');
  }
  const env = getEnv();
  const domain = env.SHOPIFY_STORE_DOMAIN;
  const status = env.SHOPIFY_PUBLISH_STATUS;

  const project = await prisma.landingProject.findUnique({
    where: { id: projectId },
    include: { images: { where: { status: 'COMPLETED', url: { not: null } }, orderBy: { slot: 'asc' } } },
  });
  if (!project) throw new LandingNotFoundError('Landing no encontrada.');

  // Idempotencia: si ya se publicó, devolver el existente sin crear de nuevo.
  if (project.shopifyProductId) {
    return {
      productId: project.shopifyProductId,
      handle: project.shopifyHandle ?? '',
      adminUrl: adminUrl(domain, project.shopifyProductId),
      alreadyPublished: true,
      status,
    };
  }

  const images = landingImagesFromProject(project.images);
  if (!images.length) throw new NoCompletedImagesError('Aún no hay imágenes generadas.');
  // Shopify descarga las imágenes por URL de forma asíncrona: deben ser https públicas.
  if (!images.every((i) => /^https:\/\//.test(i.url))) {
    throw new NoCompletedImagesError(
      'Las imágenes deben servirse por una URL pública https (configura STORAGE_DRIVER=s3 + S3_PUBLIC_BASE_URL https); el almacenamiento local (http) no es accesible por Shopify.',
    );
  }

  // Claim atómico ANTES de llamar a Shopify: solo una request gana cuando el
  // producto aún no existe y no hay otro claim vigente (o está vencido).
  const claim = await prisma.landingProject.updateMany({
    where: {
      id: projectId,
      shopifyProductId: null,
      OR: [{ shopifyPublishingAt: null }, { shopifyPublishingAt: { lt: new Date(Date.now() - CLAIM_STALE_MS) } }],
    },
    data: { shopifyPublishingAt: new Date() },
  });
  if (claim.count === 0) {
    // Otra request ya publicó o está publicando: no crear un duplicado.
    const fresh = await prisma.landingProject.findUnique({
      where: { id: projectId },
      select: { shopifyProductId: true, shopifyHandle: true },
    });
    if (fresh?.shopifyProductId) {
      return {
        productId: fresh.shopifyProductId,
        handle: fresh.shopifyHandle ?? '',
        adminUrl: adminUrl(domain, fresh.shopifyProductId),
        alreadyPublished: true,
        status,
      };
    }
    throw new PublishInProgressError('Ya hay una publicación en curso para esta landing.');
  }

  const inputs = project.inputs as unknown as LandingInputs;
  const product = buildShopifyProduct(inputs, images);
  product.status = status;

  let created: CreatedShopifyProduct;
  try {
    created = await new ShopifyClient().createProduct(product);
  } catch (err) {
    // Liberar el claim para no dejar la landing bloqueada si Shopify falla.
    await prisma.landingProject
      .updateMany({ where: { id: projectId, shopifyProductId: null }, data: { shopifyPublishingAt: null } })
      .catch(() => {});
    throw err;
  }

  await prisma.landingProject.update({
    where: { id: projectId },
    data: {
      shopifyProductId: created.id,
      shopifyHandle: created.handle,
      shopifyPublishedAt: new Date(),
      shopifyPublishingAt: null,
    },
  });

  return { productId: created.id, handle: created.handle, adminUrl: created.adminUrl, alreadyPublished: false, status };
}
