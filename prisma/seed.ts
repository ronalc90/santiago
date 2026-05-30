/**
 * Bootstrap de PRODUCCIÓN. NO crea datos de demostración: solo lo imprescindible
 * para arrancar.
 *   - Reglas de scoring por defecto.
 *   - Usuario admin leído de ADMIN_EMAIL / ADMIN_PASSWORD.
 *
 * Si ADMIN_PASSWORD no está definida, genera una contraseña aleatoria fuerte y
 * la imprime UNA sola vez (nunca se hardcodea). Es idempotente (upsert).
 *
 * Ejecutar:  npm run db:seed   (o  npm run create-admin)
 * Los anuncios reales se traen luego con «Sincronizar reales» (Apify), no aquí.
 */
import { randomBytes } from 'crypto';
import { PrismaClient, Role, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_SCORING_RULES, SETTING_KEYS } from '../lib/services/scoring';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Bootstrap de producción (sin datos demo)...');

  // Reglas de scoring por defecto (idempotente; no pisa reglas ya ajustadas).
  const scoringRulesJson = DEFAULT_SCORING_RULES as unknown as Prisma.InputJsonObject;
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.SCORING_RULES },
    create: { key: SETTING_KEYS.SCORING_RULES, value: scoringRulesJson },
    update: {},
  });

  // Admin desde el entorno; clave generada si no se define ADMIN_PASSWORD.
  const adminEmail = process.env.ADMIN_EMAIL ?? 'socio1@winspy.local';
  let adminPassword = process.env.ADMIN_PASSWORD ?? '';
  let generated = false;
  if (!adminPassword) {
    adminPassword = randomBytes(24).toString('base64url');
    generated = true;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: 'Admin', passwordHash, role: Role.ADMIN },
    update: {}, // no pisa la clave de un usuario existente
  });

  console.log('✅  Listo.');
  if (generated) {
    console.log(`    Admin: ${adminEmail} / ${adminPassword}`);
    console.log('    ⚠️  Guarda esta clave: define ADMIN_PASSWORD para fijarla.');
  } else {
    console.log(`    Admin: ${adminEmail} (clave de ADMIN_PASSWORD)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
