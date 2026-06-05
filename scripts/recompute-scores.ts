/**
 * Recalcula el Winner Score y la clasificación de TODOS los anuncios con las
 * reglas vigentes. Útil tras cambiar la fórmula del score (o las reglas) para
 * refrescar los valores ya guardados SIN tocar datos a mano.
 *
 * Reutiliza la lógica de negocio existente (lib/services/ads → recomputeAllAds),
 * así que score y clasificación siguen viviendo en un solo lugar.
 *
 * Ejecutar (con la DATABASE_URL del entorno):  npm run db:recompute
 */
import 'dotenv/config';
import { recomputeAllAds } from '../lib/services/ads';
import { prisma } from '../lib/db';

async function main(): Promise<void> {
  const n = await recomputeAllAds();
  console.log(`✅  Recalculados ${n} anuncios (Winner Score + clasificación).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
