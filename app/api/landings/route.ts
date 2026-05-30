import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiUser } from '@/lib/auth/api';
import { createLandingProject } from '@/lib/services/landing';
import { fileToBuffer } from '@/lib/http';

export const runtime = 'nodejs';

const inputsSchema = z.object({
  productName: z.string().min(1),
  offerPrice: z.coerce.number().nonnegative(),
  regularPrice: z.coerce.number().nonnegative(),
  country: z.string().min(2).max(4),
  currency: z.string().min(2).max(4),
  audience: z.string().min(1),
  description: z.string().min(1),
  offerType: z.string().min(1),
  angle: z.string().min(1),
});

const sectionsCopySchema = z.array(
  z.object({
    slot: z.number().int().min(1).max(9),
    headline: z.string(),
    bullets: z.array(z.string()),
  }),
);

/** Parsea el copy de secciones (JSON en el form); devuelve undefined si falta o es inválido. */
function parseSectionsCopy(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = sectionsCopySchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.length > 0 ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Crea un proyecto de landing (multipart/form-data con archivos opcionales). */
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const form = await req.formData();
    const productId = String(form.get('productId') ?? '');
    if (!productId) return NextResponse.json({ error: 'productId requerido' }, { status: 400 });

    const rawInputs = {
      productName: form.get('productName'),
      offerPrice: form.get('offerPrice'),
      regularPrice: form.get('regularPrice'),
      country: form.get('country'),
      currency: form.get('currency'),
      audience: form.get('audience'),
      description: form.get('description'),
      offerType: form.get('offerType'),
      angle: form.get('angle'),
    };
    const parsed = inputsSchema.safeParse(rawInputs);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const complianceTiktok = form.get('complianceTiktok') === 'true';
    const name = String(form.get('name') ?? `Landing — ${parsed.data.productName}`);
    const productPhoto = await fileToBuffer(form.get('productPhoto'));
    const referenceImage = await fileToBuffer(form.get('referenceImage'));
    const sectionsCopy = parseSectionsCopy(form.get('sectionsCopy'));

    const project = await createLandingProject({
      productId,
      name,
      inputs: { ...parsed.data, ...(sectionsCopy ? { sectionsCopy } : {}) },
      complianceTiktok,
      productPhoto,
      referenceImage,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error('[landings:create]', err);
    return NextResponse.json({ error: 'No se pudo crear la landing' }, { status: 500 });
  }
}
