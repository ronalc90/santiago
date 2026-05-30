/**
 * Seed de datos de ejemplo para probar toda la plataforma sin datos reales.
 * Crea: 2 usuarios (socios), tiendas competidoras, anuncios detectados (con
 * Winner Score y clasificación calculados), productos en distintas etapas del
 * pipeline, y un proyecto de landing de ejemplo.
 *
 * Ejecutar:  npm run db:seed
 */
import { PrismaClient, Role, DropiAvailability, ProductStatus, LandingStatus, ImageStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  computeWinnerScore,
  classifyAd,
  DEFAULT_SCORING_RULES,
  SETTING_KEYS,
} from '../lib/services/scoring';
import { LANDING_SLOTS } from '../lib/services/landing-spec';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Sembrando datos de ejemplo...');

  // --- Reglas configurables por defecto -----------------------------------
  // Las reglas son un objeto plano serializable; lo afirmamos para el campo Json de Prisma.
  const scoringRulesJson = DEFAULT_SCORING_RULES as unknown as Prisma.InputJsonObject;
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.SCORING_RULES },
    create: { key: SETTING_KEYS.SCORING_RULES, value: scoringRulesJson },
    update: { value: scoringRulesJson },
  });

  // --- Usuarios (los 2 socios) --------------------------------------------
  const passwordHash = await bcrypt.hash('changeme123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'socio1@winspy.local' },
    create: { email: 'socio1@winspy.local', name: 'Socio 1', passwordHash, role: Role.ADMIN },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: 'socio2@winspy.local' },
    create: { email: 'socio2@winspy.local', name: 'Socio 2', passwordHash, role: Role.MEMBER },
    update: {},
  });

  // --- Tiendas competidoras ------------------------------------------------
  const tiendas = [
    { name: 'GadgetPro CO', country: 'CO', adLibraryUrl: 'https://www.facebook.com/ads/library/?id=gadgetpro' },
    { name: 'HogarSmart', country: 'MX', adLibraryUrl: 'https://www.facebook.com/ads/library/?id=hogarsmart' },
    { name: 'FitLife Store', country: 'US', adLibraryUrl: 'https://www.facebook.com/ads/library/?id=fitlife' },
  ];
  const stores = [];
  for (const t of tiendas) {
    const s = await prisma.store.upsert({
      where: { name_country: { name: t.name, country: t.country } },
      create: t,
      update: {},
    });
    stores.push(s);
  }

  // --- Anuncios detectados -------------------------------------------------
  // (store, adId, country, daysActive, estimatedSpend, copy, sellsCO, unusedForeign)
  const adsSeed = [
    { store: stores[0], adId: 'AD-CO-1001', country: 'CO', daysActive: 12, spend: 18000, copy: 'Masajeador cervical recargable — alivia el dolor en minutos.', sellsCO: true, unused: false },
    { store: stores[1], adId: 'AD-MX-2001', country: 'MX', daysActive: 40, spend: 32000, copy: 'Organizador de cocina plegable — espacio infinito.', sellsCO: false, unused: true },
    { store: stores[2], adId: 'AD-US-3001', country: 'US', daysActive: 8, spend: 9000, copy: 'Posture corrector belt — feel taller instantly.', sellsCO: false, unused: true },
    { store: stores[0], adId: 'AD-CO-1002', country: 'CO', daysActive: 120, spend: 60000, copy: 'Lámpara de luna 3D — regalo perfecto.', sellsCO: true, unused: false },
    { store: stores[1], adId: 'AD-MX-2002', country: 'MX', daysActive: 6, spend: 2500, copy: 'Mini proyector portátil — cine en casa.', sellsCO: false, unused: true },
    { store: stores[2], adId: 'AD-US-3002', country: 'US', daysActive: 22, spend: 44000, copy: 'Electric callus remover — salon results at home.', sellsCO: false, unused: true },
  ];

  for (const a of adsSeed) {
    const winnerScore = computeWinnerScore(a.spend, a.daysActive);
    const classification = classifyAd(winnerScore, a.daysActive, DEFAULT_SCORING_RULES);
    await prisma.ad.upsert({
      where: { adId: a.adId },
      create: {
        adId: a.adId,
        storeId: a.store.id,
        storeName: a.store.name,
        country: a.country,
        adLibraryUrl: `https://www.facebook.com/ads/library/?id=${a.adId}`,
        copyText: a.copy,
        creativeUrl: `https://picsum.photos/seed/${a.adId}/600/600`,
        daysActive: a.daysActive,
        estimatedSpend: a.spend,
        winnerScore,
        classification,
        isNew: true,
        sellsInColombia: a.sellsCO,
        hasUnusedForeignCreative: a.unused,
      },
      update: { winnerScore, classification },
    });
  }

  // --- Productos en el pipeline -------------------------------------------
  const prodMasajeador = await prisma.product.create({
    data: {
      name: 'Masajeador cervical recargable',
      description: 'Masajeador de cuello con calor y EMS, recargable por USB.',
      status: ProductStatus.VALIDADO,
      market: 'CO',
      currency: 'COP',
      sellsInColombia: true,
      hasUnusedForeignCreative: false,
      dropiAvailability: DropiAvailability.DISPONIBLE,
      ownerId: admin.id,
      notes: 'Buen margen. Validado por demanda en CO.',
    },
  });

  await prisma.product.create({
    data: {
      name: 'Organizador de cocina plegable',
      description: 'Estante plegable multinivel para cocina.',
      status: ProductStatus.DETECTADO,
      market: 'MX',
      currency: 'MXN',
      sellsInColombia: false,
      hasUnusedForeignCreative: true,
      dropiAvailability: DropiAvailability.A_IMPORTAR,
      notes: 'Ángulo de ahorro de espacio sin usar en CO.',
    },
  });

  // Ligar el anuncio CO al producto
  await prisma.ad.update({
    where: { adId: 'AD-CO-1001' },
    data: { productId: prodMasajeador.id },
  });

  // --- Landing de ejemplo (demo, ya "completada" con placeholders) ---------
  const landing = await prisma.landingProject.create({
    data: {
      productId: prodMasajeador.id,
      name: 'Landing — Masajeador cervical (CO)',
      status: LandingStatus.COMPLETED,
      complianceTiktok: true,
      inputs: {
        productName: 'Masajeador cervical recargable',
        offerPrice: 89900,
        regularPrice: 159900,
        country: 'CO',
        currency: 'COP',
        audience: 'Adultos 30-55 con dolor de cuello por trabajo de oficina',
        description: 'Masajeador de cuello con calor y EMS, recargable por USB.',
        offerType: '2x1',
        angle: 'Alivio rápido del dolor sin ir al fisioterapeuta',
      },
      styleAnalysis: {
        visualStyle: 'minimalista premium',
        palette: ['#0F172A', '#22D3EE', '#F8FAFC'],
        atmosphere: 'luz suave de estudio',
        typography: 'sans-serif geométrica',
        iconStyle: 'líneas finas',
        effects: 'sombras suaves, gradientes sutiles',
        layout: 'centrado con jerarquía clara',
        editorialDetails: 'badges de oferta, sellos de garantía',
      },
    },
  });

  for (const slot of LANDING_SLOTS) {
    await prisma.landingImage.create({
      data: {
        projectId: landing.id,
        slot: slot.slot,
        type: slot.type,
        promptEn: `[demo] ${slot.type} image for the product, Spanish on-image copy.`,
        status: ImageStatus.COMPLETED,
        url: `https://picsum.photos/seed/landing-${slot.slot}/1000/1200`,
        width: 1000,
        height: 1200,
        bytes: 180000,
      },
    });
  }

  console.log('✅  Seed completado.');
  console.log('    Usuarios:  socio1@winspy.local / socio2@winspy.local  (clave: changeme123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
