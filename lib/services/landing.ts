import { prisma } from '@/lib/db';
import { getStorage } from '@/lib/storage';
import { getImageGenerator, RefImage } from '@/lib/images';
import { compressToWebp } from '@/lib/images/compress';
import {
  LANDING_SLOTS,
  getSlot,
  buildImagePrompt,
  LandingInputs,
  StyleAnalysis,
} from '@/lib/services/landing-spec';
import { enqueueLandingJob } from '@/lib/queue';
import { productStatusAfterLandingRemoval } from '@/lib/services/product-status';
import { getSlotIntents } from '@/lib/services/landing-slot-prompts';

export interface CreateLandingParams {
  productId: string;
  name: string;
  inputs: LandingInputs;
  complianceTiktok: boolean;
  productPhoto?: { data: Buffer; mimeType: string };
  referenceImage?: { data: Buffer; mimeType: string };
}

/**
 * Crea el proyecto de landing: guarda inputs e imágenes de entrada, crea las 9
 * filas de imagen en estado PENDING, registra un Job y lo encola.
 */
/** Extensión de archivo a partir del MIME, para que el almacenamiento conserve el tipo. */
function extFromMime(mimeType: string): string {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '.png';
}

export async function createLandingProject(params: CreateLandingParams) {
  const storage = getStorage();
  const tmpId = `landing/${params.productId}/${Date.now()}`;

  let productPhotoKey: string | null = null;
  let referenceImageKey: string | null = null;

  if (params.productPhoto) {
    const ext = extFromMime(params.productPhoto.mimeType);
    const r = await storage.put(`${tmpId}/product-photo${ext}`, params.productPhoto.data, params.productPhoto.mimeType);
    productPhotoKey = r.key;
  }
  if (params.referenceImage) {
    const ext = extFromMime(params.referenceImage.mimeType);
    const r = await storage.put(`${tmpId}/reference${ext}`, params.referenceImage.data, params.referenceImage.mimeType);
    referenceImageKey = r.key;
  }

  const project = await prisma.landingProject.create({
    data: {
      productId: params.productId,
      name: params.name,
      inputs: params.inputs as unknown as object,
      complianceTiktok: params.complianceTiktok,
      productPhotoKey,
      referenceImageKey,
      status: 'QUEUED',
      images: {
        create: LANDING_SLOTS.map((s) => ({ slot: s.slot, type: s.type, status: 'PENDING' as const })),
      },
    },
    include: { images: true },
  });

  const job = await prisma.job.create({
    data: { type: 'GENERATE_LANDING', status: 'PENDING', projectId: project.id, payload: { projectId: project.id } },
  });

  const bullJobId = await enqueueLandingJob({ projectId: project.id });
  await prisma.job.update({ where: { id: job.id }, data: { bullJobId } });

  return project;
}

/** Carga una imagen de referencia desde el almacenamiento como RefImage. */
async function loadRef(key: string | null, mime = 'image/png'): Promise<RefImage | null> {
  if (!key) return null;
  const obj = await getStorage().get(key);
  if (!obj) return null;
  return { data: obj.data, mimeType: obj.contentType || mime };
}

/**
 * Procesa la generación de una landing (lo ejecuta el worker).
 * Analiza la referencia, genera/compresiona cada imagen y actualiza progreso.
 * Si `onlySlot` se define, regenera solo ese slot.
 */
export async function processLanding(projectId: string, onlySlot?: number): Promise<void> {
  const generator = getImageGenerator();
  const storage = getStorage();

  const project = await prisma.landingProject.findUnique({ where: { id: projectId }, include: { images: true } });
  if (!project) throw new Error(`Landing ${projectId} no existe`);

  await prisma.landingProject.update({ where: { id: projectId }, data: { status: 'PROCESSING', error: null } });
  await prisma.job.updateMany({ where: { projectId, status: { in: ['PENDING', 'ACTIVE'] } }, data: { status: 'ACTIVE' } });

  try {
    const inputs = project.inputs as unknown as LandingInputs;
    const productPhoto = await loadRef(project.productPhotoKey);
    const referenceImage = await loadRef(project.referenceImageKey);

    // 1) Análisis de la imagen de referencia (8 elementos) — si hay referencia y aún no se hizo
    let style: StyleAnalysis | null = (project.styleAnalysis as unknown as StyleAnalysis) ?? null;
    if (!style && referenceImage) {
      try {
        style = await generator.analyzeReference(referenceImage);
        await prisma.landingProject.update({ where: { id: projectId }, data: { styleAnalysis: style as unknown as object } });
      } catch (err) {
        console.error('[landing:analyze]', err);
        // Continuamos sin estilo (el prompt usa un estilo por defecto)
      }
    }

    const slots = onlySlot ? LANDING_SLOTS.filter((s) => s.slot === onlySlot) : LANDING_SLOTS;
    const refs: RefImage[] = [productPhoto, referenceImage].filter(Boolean) as RefImage[];
    // Intención editable por imagen (Ajustes → Prompts por imagen): override del intent.
    const slotIntents = await getSlotIntents();

    let done = 0;
    let failures = 0;

    for (const slot of slots) {
      const image = project.images.find((i) => i.slot === slot.slot);
      if (!image) continue;
      try {
        await prisma.landingImage.update({ where: { id: image.id }, data: { status: 'PROCESSING', error: null } });

        const prompt = buildImagePrompt({ ...slot, intent: slotIntents[slot.slot] ?? slot.intent }, inputs, style, project.complianceTiktok);
        const raw = await generator.generateImage(prompt, refs);
        const webp = await compressToWebp(raw);
        const key = `landing/${projectId}/img-${slot.slot}.webp`;
        const stored = await storage.put(key, webp.data, 'image/webp');

        await prisma.landingImage.update({
          where: { id: image.id },
          data: {
            status: 'COMPLETED',
            promptEn: prompt,
            storageKey: stored.key,
            url: stored.url,
            width: webp.width,
            height: webp.height,
            bytes: webp.bytes,
          },
        });
      } catch (err) {
        failures += 1;
        const msg = err instanceof Error ? err.message : 'Error al generar';
        console.error(`[landing:slot ${slot.slot}]`, msg);
        await prisma.landingImage.update({ where: { id: image.id }, data: { status: 'FAILED', error: msg } });
      } finally {
        done += 1;
        const progress = Math.round((done / slots.length) * 100);
        await prisma.job.updateMany({ where: { projectId, status: 'ACTIVE' }, data: { progress } });
      }
    }

    // El estado global del proyecto se recalcula SIEMPRE a partir de TODAS las
    // imágenes, no solo de las del lote procesado. Así, regenerar un único slot
    // no degrada un proyecto ya COMPLETED ni "completa" uno con otros fallos.
    const finalStatus = await recomputeProjectStatus(projectId);

    await prisma.job.updateMany({
      where: { projectId, status: 'ACTIVE' },
      data: { status: finalStatus === 'FAILED' ? 'FAILED' : 'COMPLETED', progress: 100 },
    });

    // Avanza el pipeline del producto si todo salió bien
    if (finalStatus === 'COMPLETED') {
      await prisma.product.update({
        where: { id: project.productId },
        data: { status: 'LANDING_CREADA' },
      }).catch(() => {});
    }
  } catch (err) {
    // Fallo no controlado (carga de inputs, almacenamiento, etc.): el proyecto y
    // el job no pueden quedar atascados en PROCESSING. Los marcamos FAILED, las
    // imágenes que sigan pendientes también, y re-lanzamos para que BullMQ lo
    // registre (lo que dispara además el handler 'failed' del worker).
    const msg = err instanceof Error ? err.message : 'Error al generar la landing';
    console.error(`[landing:process ${projectId}]`, msg);
    await markLandingFailed(projectId, msg);
    throw err;
  }
}

/**
 * Recalcula el estado del proyecto a partir del estado de TODAS sus imágenes:
 *  - COMPLETED si todas están completadas,
 *  - FAILED si ninguna se completó,
 *  - PROCESSING si aún hay imágenes pendientes/en proceso,
 *  - COMPLETED (parcial) si hay al menos una completada y el resto falló.
 * Persiste el estado y el mensaje de error, y lo devuelve.
 */
async function recomputeProjectStatus(projectId: string): Promise<'PROCESSING' | 'COMPLETED' | 'FAILED'> {
  const images = await prisma.landingImage.findMany({ where: { projectId }, select: { status: true } });
  const total = images.length;
  const completed = images.filter((i) => i.status === 'COMPLETED').length;
  const failed = images.filter((i) => i.status === 'FAILED').length;
  const pending = images.filter((i) => i.status === 'PENDING' || i.status === 'PROCESSING').length;

  let status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  if (pending > 0) status = 'PROCESSING';
  else if (completed === total) status = 'COMPLETED';
  else if (completed === 0) status = 'FAILED';
  else status = 'COMPLETED'; // parcial: hay imágenes válidas

  await prisma.landingProject.update({
    where: { id: projectId },
    data: { status, error: failed ? `${failed} imagen(es) fallaron` : null },
  });
  return status;
}

/**
 * Marca un proyecto y sus jobs activos como FAILED de forma idempotente, y pasa
 * a FAILED las imágenes que sigan PENDING/PROCESSING. Usado ante un fallo no
 * controlado en el worker.
 */
async function markLandingFailed(projectId: string, message: string): Promise<void> {
  await prisma.landingImage.updateMany({
    where: { projectId, status: { in: ['PENDING', 'PROCESSING'] } },
    data: { status: 'FAILED', error: message },
  });
  await prisma.landingProject.update({
    where: { id: projectId },
    data: { status: 'FAILED', error: message },
  });
  await prisma.job.updateMany({
    where: { projectId, status: { in: ['PENDING', 'ACTIVE'] } },
    data: { status: 'FAILED', error: message },
  });
}

/** Marca como FAILED un proyecto/job atascados (idempotente). Lo usa el worker on 'failed'. */
export async function failLanding(projectId: string, message: string): Promise<void> {
  await markLandingFailed(projectId, message);
}

/** Reencola la regeneración de un único slot. */
export async function regenerateImage(projectId: string, slot: number): Promise<void> {
  if (!getSlot(slot)) throw new Error('Slot inválido');
  await prisma.landingImage.updateMany({ where: { projectId, slot }, data: { status: 'PENDING', error: null } });
  await prisma.job.create({
    data: { type: 'GENERATE_IMAGE', status: 'PENDING', projectId, payload: { projectId, onlySlot: slot } },
  });
  await enqueueLandingJob({ projectId, onlySlot: slot });
}

/**
 * Elimina una landing y reconcilia el estado del producto: si tras borrarla el
 * producto se queda sin ninguna landing COMPLETED, revierte su etapa (para que
 * no quede en "Landing creada" con 0 landings). Devuelve false si no existía.
 */
export async function deleteLanding(projectId: string): Promise<boolean> {
  const project = await prisma.landingProject.findUnique({
    where: { id: projectId },
    select: { id: true, productId: true },
  });
  if (!project) return false;

  await prisma.landingProject.delete({ where: { id: projectId } });

  const product = await prisma.product.findUnique({
    where: { id: project.productId },
    select: { id: true, status: true },
  });
  if (product) {
    const completed = await prisma.landingProject.count({
      where: { productId: product.id, status: 'COMPLETED' },
    });
    const next = productStatusAfterLandingRemoval(product.status, completed);
    if (next) await prisma.product.update({ where: { id: product.id }, data: { status: next } });
  }
  return true;
}

/** Reencola la regeneración de las 9 imágenes (mismo flujo que la generación inicial). */
export async function regenerateAllImages(projectId: string): Promise<void> {
  const project = await prisma.landingProject.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) throw new Error('Landing no existe');
  await prisma.landingImage.updateMany({ where: { projectId }, data: { status: 'PENDING', error: null } });
  await prisma.landingProject.update({ where: { id: projectId }, data: { status: 'QUEUED', error: null } });
  await prisma.job.create({
    data: { type: 'GENERATE_LANDING', status: 'PENDING', projectId, payload: { projectId } },
  });
  await enqueueLandingJob({ projectId });
}
