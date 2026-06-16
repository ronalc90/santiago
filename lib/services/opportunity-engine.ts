import type { OpportunityBand, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getOpportunityRules, getScoringRules } from '@/lib/services/settings';
import { computeOpportunity, OpportunityResult } from '@/lib/services/opportunity';
import { OpportunityRules, rulesVersion } from '@/lib/services/opportunity-rules';
import { buildOpportunitySignals, buildOpportunitySignalsFromAds } from '@/lib/services/opportunity-signals';

/** Trazabilidad serializable: pesos, bandas, cobertura y el desglose por dimensión. */
function buildBreakdown(result: OpportunityResult, rules: OpportunityRules, computedAtIso: string): Prisma.InputJsonValue {
  return {
    rulesVersion: rulesVersion(rules),
    computedAt: computedAtIso,
    weightsUsed: result.weightsUsed,
    weightsEffective: result.weightsEffective,
    bandsUsed: rules.bands,
    coverage: result.coverage,
    confidence: result.confidence,
    estimated: result.estimated,
    dimensions: result.dimensions,
  } as unknown as Prisma.InputJsonValue;
}

/** Campos a persistir en Product a partir de un OpportunityResult. */
function persistFields(result: OpportunityResult, rules: OpportunityRules, now: Date) {
  return {
    opportunityScore: result.score,
    opportunityBand: result.band as OpportunityBand,
    opportunityConfidence: result.confidence,
    opportunityEstimated: result.estimated,
    demandScore: result.dimensions.demand.score,
    competitionScore: result.dimensions.competition.score,
    marginScore: result.dimensions.margin.score,
    creativesScore: result.dimensions.creatives.score,
    opportunityBreakdown: buildBreakdown(result, rules, now.toISOString()),
    opportunityComputedAt: now,
  };
}

/**
 * Calcula la oportunidad de UN producto a partir de datos YA persistidos (CERO
 * red): la saturación de ML sale de `saturationCount` (lo mide el worker) y el
 * costo de Shopify/manual. Persiste el resultado; null si el producto no existe.
 */
export async function computeAndPersistOpportunity(productId: string): Promise<OpportunityResult | null> {
  const rules = await getOpportunityRules();
  const signals = await buildOpportunitySignals(productId);
  if (!signals) return null;
  const result = computeOpportunity(signals, rules);
  await prisma.product.update({ where: { id: productId }, data: persistFields(result, rules, new Date()) });
  return result;
}

/**
 * Recalcula la oportunidad de TODOS los productos SOLO con datos de BD (Ads),
 * sin pegar a ML/Dropi (espejo de recomputeAllAds: cero gasto externo). Las
 * dimensiones de competencia/margen quedan estimadas si esas fuentes no se
 * persistieron en un recompute individual previo.
 */
export async function recomputeAllProductsOpportunity(): Promise<number> {
  const [rules, scoring] = await Promise.all([getOpportunityRules(), getScoringRules()]);
  const products = await prisma.product.findMany({ include: { ads: true } });
  const now = new Date();
  // Lotes acotados en paralelo (en vez de N+1 secuencial) para reducir wall-clock
  // y no agotar el tiempo de la función serverless.
  const CHUNK = 25;
  let n = 0;
  for (let i = 0; i < products.length; i += CHUNK) {
    const chunk = products.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map((product) => {
        const signals = buildOpportunitySignalsFromAds(
          {
            salePrice: product.salePrice ?? null,
            shopifyUnitCost: product.shopifyUnitCost ?? null,
            manualCost: product.manualCost ?? null,
            shippingCost: product.shippingCost ?? null,
            saturationCount: product.saturationCount ?? null,
            dropiAvailability: product.dropiAvailability,
            hasUnusedForeignCreative: product.hasUnusedForeignCreative,
          },
          product.ads,
          scoring.minDiasOtroPais,
        );
        const result = computeOpportunity(signals, rules);
        return prisma.product.update({ where: { id: product.id }, data: persistFields(result, rules, now) });
      }),
    );
    n += chunk.length;
  }
  return n;
}
