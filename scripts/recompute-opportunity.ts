/**
 * Recalcula el score de Oportunidad de TODOS los productos con las reglas
 * vigentes, usando SOLO datos de BD (sin pegar a ML/Dropi). Útil tras cambiar la
 * fórmula o las reglas. Ejecutar: npm run db:recompute-opportunity
 */
import 'dotenv/config';
import { recomputeAllProductsOpportunity } from '../lib/services/opportunity-engine';
import { prisma } from '../lib/db';

async function main(): Promise<void> {
  const n = await recomputeAllProductsOpportunity();
  console.log(`✅  Recalculada la oportunidad de ${n} producto(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
