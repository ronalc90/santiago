import { ImageStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config/env';

/**
 * Cálculo de costos de la plataforma (capa de servicio).
 *
 * Dos partes:
 *  1) Catálogo de costos UNITARIOS por acción + costos mensuales de infra, cada
 *     uno con su "por qué".
 *  2) Estimación de lo GASTADO hasta ahora, derivada de conteos reales en la BD
 *     (anuncios traídos, imágenes generadas, etc.) × costo unitario.
 *
 * Nota honesta: no tenemos acceso a las APIs de facturación de Apify/OpenAI/
 * Gemini/Railway/Vercel, así que el "gastado" es una ESTIMACIÓN basada en
 * conteos, no el monto facturado exacto. Los costos unitarios son editables aquí
 * y la tasa USD→COP vive en env (USD_COP_RATE).
 */

export type CostKind = 'per-action' | 'monthly';

export interface UnitCost {
  key: string;
  label: string;
  unit: string;
  usd: number;
  kind: CostKind;
  why: string;
}

/** Costos unitarios y mensuales (ajustables). USD; la conversión a COP es dinámica. */
export const COST_CATALOG: UnitCost[] = [
  {
    key: 'apify-ad',
    label: 'Traer 1 anuncio del Meta Ad Library (Apify)',
    unit: 'por anuncio',
    usd: 0.00075,
    kind: 'per-action',
    why: 'El actor curious_coder de Apify cobra ~USD 0.75 por cada 1.000 anuncios scrapeados (pay-per-result). Mínimo 10 resultados por corrida.',
  },
  {
    key: 'gemini-image',
    label: 'Generar 1 imagen de landing (Gemini «nano banana»)',
    unit: 'por imagen',
    usd: 0.039,
    kind: 'per-action',
    why: 'Gemini 2.5 Flash Image factura por tokens de salida; una imagen ≈ 1.290 tokens ≈ USD 0.039.',
  },
  {
    key: 'openai-copy',
    label: 'Generar copy/texto (OpenAI gpt-4o-mini)',
    unit: 'por generación',
    usd: 0.0008,
    kind: 'per-action',
    why: 'gpt-4o-mini: ~USD 0.15 por 1M tokens de entrada y 0.60 por 1M de salida; una generación de copy ronda 1–2K tokens.',
  },
  {
    key: 'apify-plan',
    label: 'Plan Apify (plataforma)',
    unit: 'mensual',
    usd: 0,
    kind: 'monthly',
    why: 'El free tier da ~USD 5/mes de crédito (suficiente para empezar). Planes pagos desde ~USD 39/mes si subes el volumen.',
  },
  {
    key: 'railway',
    label: 'Railway (worker BullMQ + Redis/Postgres)',
    unit: 'mensual',
    usd: 5,
    kind: 'monthly',
    why: 'El worker corre 24/7 para la ingesta y la generación de landings; plan Hobby ~USD 5/mes + consumo de recursos.',
  },
  {
    key: 'vercel',
    label: 'Vercel (app Next.js)',
    unit: 'mensual',
    usd: 0,
    kind: 'monthly',
    why: 'El plan Hobby es gratis para uso personal; Pro ~USD 20/mes si se necesita uso comercial o más límites.',
  },
];

export interface CostLine extends UnitCost {
  cop: number;
}

export interface SpentLine {
  key: string;
  label: string;
  detail: string;
  count: number;
  usd: number;
  cop: number;
}

export interface CostReport {
  rate: number;
  catalog: CostLine[];
  spent: SpentLine[];
  spentTotalUsd: number;
  spentTotalCop: number;
  monthlyUsd: number;
  monthlyCop: number;
}

function unit(key: string): number {
  return COST_CATALOG.find((c) => c.key === key)?.usd ?? 0;
}

/** Genera el reporte de costos: catálogo + estimación de lo gastado. */
export async function computeCostReport(): Promise<CostReport> {
  const rate = getEnv().USD_COP_RATE;
  const cop = (usd: number) => Math.round(usd * rate);

  // Conteos reales en la BD que sirven de base para estimar el gasto.
  const [adCount, imageCount, landingCount] = await Promise.all([
    prisma.ad.count(),
    prisma.landingImage.count({ where: { status: ImageStatus.COMPLETED } }),
    prisma.landingProject.count(),
  ]);

  // OpenAI no se persiste por llamada; estimamos ~2 generaciones de texto por
  // landing (sugerencia de producto + copy). Es una aproximación.
  const openaiGenerations = landingCount * 2;

  const spentRaw: Omit<SpentLine, 'cop'>[] = [
    {
      key: 'apify-ad',
      label: 'Anuncios traídos (Apify)',
      detail: `${adCount} anuncios × USD ${unit('apify-ad')}`,
      count: adCount,
      usd: adCount * unit('apify-ad'),
    },
    {
      key: 'gemini-image',
      label: 'Imágenes generadas (Gemini)',
      detail: `${imageCount} imágenes × USD ${unit('gemini-image')}`,
      count: imageCount,
      usd: imageCount * unit('gemini-image'),
    },
    {
      key: 'openai-copy',
      label: 'Generaciones de texto (OpenAI, estimado)',
      detail: `~${openaiGenerations} generaciones × USD ${unit('openai-copy')} (≈2 por landing)`,
      count: openaiGenerations,
      usd: openaiGenerations * unit('openai-copy'),
    },
  ];

  const spent: SpentLine[] = spentRaw.map((s) => ({ ...s, cop: cop(s.usd) }));
  const catalog: CostLine[] = COST_CATALOG.map((c) => ({ ...c, cop: cop(c.usd) }));

  const spentTotalUsd = spent.reduce((acc, s) => acc + s.usd, 0);
  const monthlyUsd = COST_CATALOG.filter((c) => c.kind === 'monthly').reduce((acc, c) => acc + c.usd, 0);

  return {
    rate,
    catalog,
    spent,
    spentTotalUsd,
    spentTotalCop: cop(spentTotalUsd),
    monthlyUsd,
    monthlyCop: cop(monthlyUsd),
  };
}
