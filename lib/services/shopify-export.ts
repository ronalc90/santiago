import { LandingInputs, getSlot } from '@/lib/services/landing-spec';

/**
 * Arma un PRODUCTO de Shopify a partir de una landing terminada y lo exporta como
 * CSV de importación (Shopify → Productos → Importar). La página de ventas son las
 * 9 imágenes apiladas como descripción (body HTML) + el copy de IA.
 *
 * `buildShopifyProduct` es la pieza reutilizable: hoy alimenta el CSV; el día que
 * se conecte la Admin API de Shopify, el mismo objeto se envía por API sin rehacer
 * el armado (Single Responsibility / Open-Closed).
 */

/** Una imagen del producto (URL pública para que Shopify la descargue). */
export interface ShopifyImage {
  src: string;
  alt: string;
  position: number;
}

/** Representación neutral de un producto de Shopify (independiente de CSV/API). */
export interface ShopifyProduct {
  handle: string;
  title: string;
  bodyHtml: string;
  vendor: string;
  tags: string;
  price: string;
  compareAtPrice: string;
  /** 'draft' (borrador, recomendado) o 'active'. */
  status: 'draft' | 'active';
  images: ShopifyImage[];
}

/** Imagen de una landing ya generada (URL pública + slot/tipo). */
export interface LandingImageRef {
  slot: number;
  type: string;
  url: string;
}

/** Mapea las imágenes de un proyecto a referencias del builder, descartando las sin URL. */
export function landingImagesFromProject(
  images: { slot: number; type: string; url: string | null }[],
): LandingImageRef[] {
  return images
    .map((i) => ({ slot: i.slot, type: i.type, url: i.url ?? '' }))
    .filter((i) => i.url);
}

/** Convierte un texto a un handle/slug válido para Shopify. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (diacríticos combinados)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'producto';
}

/** Escapa el texto para usarlo dentro de un atributo HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Etiqueta legible (español) de un slot, para el alt de la imagen. */
function altForImage(img: LandingImageRef): string {
  return getSlot(img.slot)?.title ?? img.type;
}

/**
 * Cuerpo HTML de la página de ventas: las 9 imágenes apiladas (a ancho completo) +
 * un bloque de texto con el copy de IA para SEO/accesibilidad.
 */
function buildBodyHtml(inputs: LandingInputs, images: ShopifyImage[]): string {
  const intro = inputs.description?.trim()
    ? `<p>${escapeHtml(inputs.description.trim())}</p>`
    : '';
  const imgs = images
    .map(
      (i) =>
        `<img src="${escapeHtml(i.src)}" alt="${escapeHtml(i.alt)}" style="width:100%;height:auto;display:block;margin:0 auto 12px" loading="lazy">`,
    )
    .join('');
  // Beneficios en texto (de las secciones de copy, si las hay) para SEO.
  const bullets = (inputs.sectionsCopy ?? [])
    .flatMap((s) => s.bullets)
    .filter(Boolean)
    .slice(0, 8);
  const benefits = bullets.length
    ? `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
    : '';
  // HTML en una sola línea (sin saltos): así cada producto ocupa una fila de CSV.
  return `<div style="max-width:720px;margin:0 auto">${intro}${imgs}${benefits}</div>`;
}

/** Construye el producto de Shopify a partir de la landing (inputs + imágenes). */
export function buildShopifyProduct(inputs: LandingInputs, landingImages: LandingImageRef[]): ShopifyProduct {
  const images: ShopifyImage[] = landingImages
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((img, i) => ({ src: img.url, alt: altForImage(img), position: i + 1 }));

  const compareAt = inputs.regularPrice > inputs.offerPrice ? String(inputs.regularPrice) : '';
  const tags = [inputs.country, inputs.offerType].filter(Boolean).join(', ');

  return {
    handle: slugify(inputs.productName),
    title: inputs.productName,
    bodyHtml: buildBodyHtml(inputs, images),
    vendor: inputs.productName,
    tags,
    price: String(inputs.offerPrice ?? 0),
    compareAtPrice: compareAt,
    status: 'draft',
    images,
  };
}

/** Escapa una celda para CSV (comillas, comas y saltos de línea). */
function csvCell(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Columnas del CSV de productos de Shopify que usamos. */
const CSV_HEADER = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Status',
];

/**
 * Genera el CSV de importación de Shopify para un producto. La primera fila lleva
 * todos los datos del producto + la primera imagen; las siguientes filas repiten
 * solo el handle y una imagen extra (formato estándar de Shopify para galerías).
 */
export function toShopifyProductCsv(product: ShopifyProduct): string {
  const first = product.images[0];
  const firstRow = [
    product.handle,
    product.title,
    product.bodyHtml,
    product.vendor,
    product.tags,
    'FALSE', // Published: borrador
    'Title',
    'Default Title',
    '100',
    'deny',
    'manual',
    product.price,
    product.compareAtPrice,
    'TRUE',
    'TRUE',
    first?.src ?? '',
    first ? String(first.position) : '',
    first?.alt ?? '',
    product.status,
  ];

  const extraImageRows = product.images.slice(1).map((img) => [
    product.handle,
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', // columnas del producto vacías
    img.src,
    String(img.position),
    img.alt,
    '',
  ]);

  const rows = [CSV_HEADER, firstRow, ...extraImageRows];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}
