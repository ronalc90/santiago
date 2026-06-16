import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config/env';
import { encryptSecret, decryptSecret } from '@/lib/crypto/secret-box';
import { computeAndPersistOpportunity } from '@/lib/services/opportunity-engine';
import { isMeliConfigured, refreshAccessToken, searchListingTotal, MeliTokenResponse } from '@/lib/integrations/mercadolibre';

/**
 * Servicio de MercadoLibre: persiste los tokens OAuth (CIFRADOS) en BD, los
 * refresca solo cuando hace falta y mide la saturación CO de los productos
 * (nº de publicaciones), persistiendo `saturationCount`. El motor de oportunidad
 * lee ese conteo desde el producto (no consulta ML en caliente).
 */
const PROVIDER = 'meli';
const STATUS_KEY = 'meli_saturation_status';
const REFRESH_MARGIN_MS = 60_000; // refrescar 1 min antes de expirar
const CHUNK = 10; // lotes pequeños para respetar el rate-limit de ML

export interface MeliConnection {
  connected: boolean;
  needsReconnect: boolean; // hay token pero no se puede descifrar (AUTH_SECRET rotado/corrupto)
  externalId: string | null;
  expiresAt: string | null; // ISO
}

export interface MeliSaturationResult {
  configured: boolean; // hay client_id/secret
  connected: boolean; // hay token OAuth válido en BD
  total: number; // productos
  measured: number; // búsquedas con dato (paging.total numérico, 0 incluido)
  updated: number; // saturación que cambió
  withoutData: number; // búsquedas sin dato (null: no medible)
  at: string; // ISO
}

/** Guarda/renueva la conexión OAuth con los tokens cifrados en reposo. */
export async function saveMeliConnection(token: MeliTokenResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + token.expiresIn * 1000);
  const data = {
    accessToken: encryptSecret(token.accessToken),
    refreshToken: encryptSecret(token.refreshToken),
    expiresAt,
    scope: token.scope,
    externalId: token.userId,
  };
  await prisma.oAuthToken.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, ...data },
    update: data,
  });
}

/** Estado de conexión para la UI (no expone tokens). */
export async function getMeliConnection(): Promise<MeliConnection> {
  const row = await prisma.oAuthToken.findUnique({ where: { provider: PROVIDER } });
  if (!row) return { connected: false, needsReconnect: false, externalId: null, expiresAt: null };
  // Si el refresh no se puede descifrar (AUTH_SECRET rotado/corrupto), la "conexión"
  // es inservible: avisamos para que la UI invite a reconectar en vez de mentir.
  let needsReconnect = false;
  try {
    decryptSecret(row.refreshToken);
  } catch {
    needsReconnect = true;
  }
  return { connected: true, needsReconnect, externalId: row.externalId, expiresAt: row.expiresAt.toISOString() };
}

/** Desconecta (borra los tokens). */
export async function disconnectMeli(): Promise<void> {
  await prisma.oAuthToken.deleteMany({ where: { provider: PROVIDER } });
}

/** Pura: ¿el token expira dentro del margen? (testeable sin BD). */
export function needsRefresh(expiresAt: Date, now: number): boolean {
  return expiresAt.getTime() <= now + REFRESH_MARGIN_MS;
}

/**
 * Devuelve un access token válido (refrescándolo si está por expirar) o null si
 * no hay conexión o el refresh falla.
 *
 * El refresh token de ML es de un solo uso: tras renovarlo hay que PERSISTIR el
 * rotado sí o sí. Si la BD falla, se reintenta y, si aun así no se logra, se
 * loguea CRÍTICO (la conexión quedará inválida y habrá que reconectar). Se asume
 * un único worker (la cola serializa con concurrency=1): no hay refresh
 * concurrente que pudiera quemar dos veces el mismo refresh token.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const row = await prisma.oAuthToken.findUnique({ where: { provider: PROVIDER } });
  if (!row) return null;
  if (!needsRefresh(row.expiresAt, Date.now())) {
    try {
      return decryptSecret(row.accessToken);
    } catch {
      console.error('[meli] no se pudo descifrar el access token (¿rotó AUTH_SECRET?); reconecta MercadoLibre.');
      return null;
    }
  }
  let currentRefresh: string;
  try {
    currentRefresh = decryptSecret(row.refreshToken);
  } catch {
    console.error('[meli] no se pudo descifrar el refresh token (¿rotó AUTH_SECRET?); reconecta MercadoLibre.');
    return null;
  }

  let fresh;
  try {
    fresh = await refreshAccessToken(currentRefresh);
  } catch (e) {
    console.error('[meli] refresh falló (red/OAuth):', e instanceof Error ? e.message : e);
    return null;
  }

  // Persistir el refresh rotado con reintentos: perderlo deja la conexión muerta.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await saveMeliConnection(fresh);
      return fresh.accessToken;
    } catch (e) {
      if (attempt === 3) {
        console.error(
          '[meli] CRÍTICO: el refresh token rotado NO se pudo persistir; la conexión quedará inválida y habrá que reconectar MercadoLibre en Ajustes.',
          e instanceof Error ? e.message : e,
        );
        // El access token devuelto sí sirve para ESTA corrida.
        return fresh.accessToken;
      }
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
  return fresh.accessToken;
}

async function saveStatus(result: MeliSaturationResult): Promise<void> {
  await prisma.setting.upsert({
    where: { key: STATUS_KEY },
    create: { key: STATUS_KEY, value: result as unknown as Prisma.InputJsonValue },
    update: { value: result as unknown as Prisma.InputJsonValue },
  });
}

/** Último resumen de medición de saturación (para la UI). */
export async function getMeliSaturationStatus(): Promise<MeliSaturationResult | null> {
  const row = await prisma.setting.findUnique({ where: { key: STATUS_KEY } });
  return row ? (row.value as unknown as MeliSaturationResult) : null;
}

async function inChunks<T>(items: T[], fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    await Promise.all(items.slice(i, i + CHUNK).map(fn));
  }
}

/**
 * Mide la saturación CO de todos los productos y persiste `saturationCount`
 * (solo cuando cambia, para no recalcular en vano). Recalcula la oportunidad de
 * los productos cuyo conteo cambió. Un access token por corrida (evita carreras
 * de refresh). Degrada con `connected:false` si no hay OAuth.
 */
export async function syncMeliSaturation(): Promise<MeliSaturationResult> {
  const base: MeliSaturationResult = {
    configured: isMeliConfigured(),
    connected: false,
    total: 0,
    measured: 0,
    updated: 0,
    withoutData: 0,
    at: new Date().toISOString(),
  };
  if (!base.configured) {
    await saveStatus(base);
    return base;
  }
  const token = await getValidAccessToken();
  if (!token) {
    await saveStatus(base);
    return base;
  }

  const env = getEnv();
  const products = await prisma.product.findMany({ select: { id: true, name: true, saturationKeyword: true, saturationCount: true } });
  let measured = 0;
  let withoutData = 0;
  const toUpdate: { id: string; count: number }[] = [];

  for (let i = 0; i < products.length; i += CHUNK) {
    const chunk = products.slice(i, i + CHUNK);
    const counts = await Promise.all(
      chunk.map((p) => searchListingTotal(env.MELI_SITE_ID, p.saturationKeyword?.trim() || p.name, token)),
    );
    chunk.forEach((p, idx) => {
      const count = counts[idx];
      if (count == null) {
        withoutData += 1;
        return;
      }
      measured += 1;
      if (p.saturationCount !== count) toUpdate.push({ id: p.id, count });
    });
  }

  const now = new Date();
  await inChunks(toUpdate, (u) => prisma.product.update({ where: { id: u.id }, data: { saturationCount: u.count, saturationUpdatedAt: now } }));
  await inChunks(toUpdate, (u) => computeAndPersistOpportunity(u.id).catch(() => {}));

  const result: MeliSaturationResult = { ...base, connected: true, total: products.length, measured, updated: toUpdate.length, withoutData };
  await saveStatus(result);
  return result;
}
