/**
 * Elimina los datos de DEMOSTRACIÓN que el seed antiguo pudo haber dejado en la
 * base de datos (tiendas/anuncios/productos/landing ficticios), para que en
 * producción SOLO queden datos reales.
 *
 * Es seguro e idempotente: borra únicamente registros con los marcadores del
 * seed demo y los anuncios "MOCK-*" del provider mock. No toca datos reales
 * (anuncios de Apify con id numérico, importados, etc.).
 *
 * Ejecutar (con la DATABASE_URL de producción):  npm run db:purge-demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_STORE_NAMES = ['GadgetPro CO', 'HogarSmart', 'FitLife Store'];
const DEMO_AD_IDS = ['AD-CO-1001', 'AD-MX-2001', 'AD-US-3001', 'AD-CO-1002', 'AD-MX-2002', 'AD-US-3002'];
const DEMO_PRODUCT_NAMES = ['Masajeador cervical recargable', 'Organizador de cocina plegable'];

async function main() {
  console.log('🧹  Purgando datos demo...');

  // Productos y landings demo (primero las dependencias por las FK).
  // Incluye los productos generados con el generador de texto MOCK, que llevan
  // el marcador "(mock)" en el nombre (p. ej. "Producto de ejemplo (mock)").
  const demoProducts = await prisma.product.findMany({
    where: {
      OR: [{ name: { in: DEMO_PRODUCT_NAMES } }, { name: { contains: '(mock)' } }],
    },
    select: { id: true },
  });
  const demoProductIds = demoProducts.map((p) => p.id);

  const demoLandings = await prisma.landingProject.findMany({
    where: {
      OR: [
        { productId: { in: demoProductIds } },
        { name: { contains: 'Masajeador cervical' } },
      ],
    },
    select: { id: true },
  });
  const demoLandingIds = demoLandings.map((l) => l.id);

  const imgs = await prisma.landingImage.deleteMany({ where: { projectId: { in: demoLandingIds } } });
  const landings = await prisma.landingProject.deleteMany({ where: { id: { in: demoLandingIds } } });

  // Anuncios demo: por id de seed, por prefijo MOCK- o por tienda ficticia.
  const ads = await prisma.ad.deleteMany({
    where: {
      OR: [
        { adId: { in: DEMO_AD_IDS } },
        { adId: { startsWith: 'MOCK-' } },
        { storeName: { in: DEMO_STORE_NAMES } },
      ],
    },
  });

  const products = await prisma.product.deleteMany({ where: { id: { in: demoProductIds } } });
  const stores = await prisma.store.deleteMany({ where: { name: { in: DEMO_STORE_NAMES } } });

  console.log(
    `✅  Eliminados: ${stores.count} tiendas, ${ads.count} anuncios, ${products.count} productos, ` +
      `${landings.count} landings, ${imgs.count} imágenes de landing.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
