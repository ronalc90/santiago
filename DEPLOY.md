# Despliegue de WinSpy a producción

Arquitectura: **Web/API en Vercel** (serverless) + **Worker en Railway** (proceso
persistente) + **Postgres en Neon** + **Redis en Upstash** + **almacenamiento en
S3/Cloudflare R2**. La web y el worker comparten el MISMO `DATABASE_URL`,
`REDIS_URL` y bucket.

> Vercel no puede correr el worker persistente de BullMQ; por eso va en Railway.

Repositorio: https://github.com/ronalc90/santiago

---

## 0) Antes de empezar — rotar secretos

- **GEMINI_API_KEY**: la del `.env` local es de pruebas. Genera una nueva en
  https://aistudio.google.com/apikey y úsala solo como variable de entorno.
- **AUTH_SECRET**: `openssl rand -base64 32`
- **INGEST_API_TOKEN**: `openssl rand -hex 24`

Nunca pongas secretos en el repo. Usa la plantilla `.env.production.example`.

---

## 1) Base de datos — Neon (Postgres)

1. Crea un proyecto en https://neon.tech → base de datos `winspy`.
2. Copia DOS cadenas de conexión:
   - **Pooled** (con `-pooler` en el host) → para la app en Vercel (`DATABASE_URL`).
   - **Direct** (sin `-pooler`) → para correr las migraciones.
3. Añade `?sslmode=require` al final si no viene.

Aplicar el esquema a producción (desde tu máquina, con la cadena *direct*):

```bash
DATABASE_URL="postgresql://...direct...?sslmode=require" npm run db:deploy
```

> **No corras `npm run db:seed` contra producción.** El seed carga datos DEMO
> (tiendas, anuncios y una landing de ejemplo con placeholders) pensados solo para
> desarrollo. En producción quieres la BD limpia.

### Crear el usuario admin (producción)

El primer usuario admin se crea con las variables `ADMIN_EMAIL` y `ADMIN_PASSWORD`,
**no** con el seed demo:

- Define `ADMIN_EMAIL` y una `ADMIN_PASSWORD` **fuerte** (gestor de contraseñas o
  `openssl rand -base64 24`). Nunca uses la clave demo.
- Si `ADMIN_PASSWORD` no se define al crear el admin, se genera una clave aleatoria
  fuerte y se imprime **una sola vez** por consola: cópiala de inmediato.

```bash
DATABASE_URL="postgresql://...direct...?sslmode=require" \
ADMIN_EMAIL="admin@tudominio.com" \
ADMIN_PASSWORD="UNA_CLAVE_FUERTE" \
  npm run create-admin
```

> El bootstrap **no** crea datos demo. Los anuncios reales se traen luego con el
> botón **«Buscar anuncios»** (o `POST /api/ads/sync`) usando Apify.

**Si tu base ya tiene datos de demostración** (de un seed antiguo: tiendas
GadgetPro/HogarSmart/FitLife, anuncios `AD-*`/`MOCK-*`), límpialos una vez:

```bash
DATABASE_URL="postgresql://...direct...?sslmode=require" npm run db:purge-demo
```

## 2) Redis — Upstash

1. Crea una base Redis en https://upstash.com (región cercana a Vercel/Railway).
2. Copia la **URL TLS** (`rediss://default:...@...upstash.io:6379`) → `REDIS_URL`.

## 3) Almacenamiento — Cloudflare R2 (o S3)

1. Crea un bucket `winspy` en Cloudflare R2.
2. Crea un API Token R2 (Access Key ID + Secret).
3. Habilita acceso público del bucket (o un dominio propio) para servir las imágenes.
4. Variables: `STORAGE_DRIVER=s3`, `S3_ENDPOINT` (`https://<accountid>.r2.cloudflarestorage.com`),
   `S3_REGION=auto`, `S3_BUCKET=winspy`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
   `S3_PUBLIC_BASE_URL`.

## 4) Web/API — Vercel

1. https://vercel.com → New Project → importa `ronalc90/santiago`.
2. Framework: Next.js (autodetectado). Build command por defecto (`npm run build`).
3. Define TODAS las variables de entorno (ver `.env.production.example`), incluido
   `APP_URL` con la URL final de Vercel.
4. Deploy. La app queda en `https://santiago-XXXX.vercel.app`.

## 5) Worker — Railway

1. https://railway.app → New Project → Deploy from GitHub → `ronalc90/santiago`.
2. **Start command**: `npm run worker`.
3. Variables de entorno (ver detalle abajo). El worker **carga `lib/config/env.ts`
   al importar**, así que faltar una variable obligatoria hace que el worker crashee
   al arrancar.
4. Deploy. El worker se conecta a la cola y procesa tanto la ingesta de anuncios
   reales como la generación de las 9 imágenes de cada landing.

> `postinstall` ejecuta `prisma generate` automáticamente en ambos servicios.
> `tsx` y `prisma` están en `dependencies` para que el worker arranque en prod.

### Variables que el Worker NECESITA (Railway)

El worker es quien llama a `getAdSource().fetchAds()` (Apify) y a Gemini; **no** es
Vercel. Por eso muchas variables que parecen "de la app" tienen que estar también
(o sobre todo) aquí. Define en Railway:

| Variable | Obligatoria | Notas |
|---|---|---|
| `DATABASE_URL` | Sí | La MISMA que Vercel (pooled o direct). |
| `REDIS_URL` | Sí | La MISMA cola que Vercel (Upstash, `rediss://`). |
| `AUTH_SECRET` | Sí | **Sin esto el worker crashea al arrancar** (mín. 16 chars). |
| `INGEST_API_TOKEN` | Sí | **Sin esto el worker crashea al arrancar** (mín. 8 chars). |
| `AD_SOURCE_PROVIDER` | Sí (reales) | `"apify"` para anuncios reales. Con `"mock"` trae datos **demo**. |
| `APIFY_TOKEN` | Sí si `apify` | Sin el token con provider `apify`, `env.ts` lanza y el worker crashea. **Sin Apify la ingesta devuelve datos demo (mock).** |
| `APIFY_ACTOR_ID` | Recomendada | Default: `curious_coder~facebook-ads-library-scraper`. |
| `AD_SOURCE_COUNTRY` | Recomendada | País ISO-2 por defecto (ej. `CO`). |
| `AD_SOURCE_COUNTRIES` | Opcional | CSV de países para el cron (ej. `CO,US,MX`). Vacío = solo `AD_SOURCE_COUNTRY`. El costo de Apify escala con países × keywords × límite. |
| `AD_SOURCE_KEYWORDS` | Recomendada | CSV de nichos. Vacío = la ingesta automática no encola nada. |
| `AD_SOURCE_LIMIT` | Opcional | Máx. resultados por job (controla el costo de Apify). |
| `AD_SOURCE_CRON` | Opcional | Patrón BullMQ para ingesta automática; vacío = desactivado. |
| `WORKER_CONCURRENCY` | Opcional | Concurrencia del worker de imágenes (default 2). |
| `AD_WORKER_CONCURRENCY` | Opcional | Concurrencia del worker de ingesta (default 1). |
| `IMAGE_PROVIDER` + `GEMINI_API_KEY` | Sí (imágenes) | El worker genera las 9 imágenes; con `gemini` exige la key. |
| `GEMINI_IMAGE_MODEL`, `GEMINI_TEXT_MODEL` | Recomendada | Mismos valores que Vercel. |
| `STORAGE_DRIVER="s3"` + `S3_*` | Sí (prod) | El worker **sube** las imágenes generadas al bucket. |

> Resumen: el worker necesita TODAS estas, no solo las "de cola". Si faltan
> `AUTH_SECRET` o `INGEST_API_TOKEN`, el proceso ni siquiera arranca.

## 6) Disparar la ingesta de anuncios REALES

La ingesta real la ejecuta el **worker** (Apify). Hay dos formas de dispararla:

- **Desde la UI**: Spy → botón **«Buscar anuncios»** (arriba de la tabla). Encola
  trabajos con `AD_SOURCE_COUNTRY` / `AD_SOURCE_KEYWORDS` / `AD_SOURCE_LIMIT`.
- **Por API** (cron o externos): `POST /api/ads/sync`. Autenticación por sesión ADMIN
  o por header `x-ingest-token`. Cuerpo opcional `{ country, keywords[], pageUrl, limit }`;
  si no se envía, usa los `AD_SOURCE_*` del entorno del worker.

```bash
# Disparar la ingesta real (usa tu INGEST_API_TOKEN de prod)
curl -X POST https://TU-APP.vercel.app/api/ads/sync \
  -H 'Content-Type: application/json' -H 'x-ingest-token: TU_TOKEN' \
  -d '{"country":"CO","keywords":["nicho1","nicho2"],"limit":50}'
```

> Si en el worker `AD_SOURCE_PROVIDER` no es `"apify"` (o falta `APIFY_TOKEN`), la
> ingesta devuelve datos **demo (mock)**, no anuncios reales.

## 7) Prueba de humo en producción

```bash
# login (usa el admin creado con ADMIN_EMAIL/ADMIN_PASSWORD)
curl -i -c ck.txt -X POST https://TU-APP.vercel.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'
```

Luego, en la UI: pulsa **«Buscar anuncios»** y espera a que el worker traiga los
anuncios → crea producto → nueva landing → verifica que el worker genera las 9
imágenes y que el `.zip` descarga.

## 8) Costos / Margen desde Shopify

Dropi **no da API a terceros**, así que el costo no se lee de Dropi. La vía oficial:

1. En tu panel de **Dropi**, conecta **Dropi → Shopify** (integración oficial). Eso
   sincroniza los productos y su **«costo por artículo»** a Shopify.
2. La Custom App de Shopify (la misma del token `shpat_`) debe tener el scope
   **`read_inventory`** además de `write_products`. Si falta, la sync de costos lo
   reporta como pendiente (no falla en silencio): actualiza los permisos y reinstala.
3. WinSpy lee el costo de Shopify (`inventoryItem.unitCost`) con el token existente y
   lo usa para el **Margen** del score. Botón **«Sincronizar costos (Shopify)»** en
   Ajustes (corre en el worker) + un **refresco diario** (`COST_SYNC_CRON`).

| Variable | ¿Cuándo? | Qué |
|---|---|---|
| `COST_SYNC_CRON` | Opcional | Patrón cron del refresco diario de costos (default `0 7 * * *`; vacío = off). |

> El costo manual por producto sigue disponible como fallback editable; si hay costo
> de Shopify, se usa ese. Si no hay ningún costo, el margen se marca «estimado».

## 9) Competencia / Saturación desde MercadoLibre

Mide la **saturación real en Colombia** (nº de publicaciones por producto) con la API
oficial de MercadoLibre y la usa en la dimensión **«Competencia»** del motor 4×25.

1. Crea una app gratis en **developers.mercadolibre.com** (sitio Colombia).
2. Registra la **URI de redirect** EXACTA (debe coincidir con la de WinSpy):
   - Producción: `https://TU_DOMINIO/api/integrations/meli/callback`
   - Local: `http://localhost:3000/api/integrations/meli/callback`
3. Configura `MELI_CLIENT_ID` y `MELI_CLIENT_SECRET` en **Vercel** y en el **Worker**
   (Railway). Si registraste una URI distinta a la derivada de `APP_URL`, fíjala en
   `MELI_REDIRECT_URI` (debe ser idéntica a la de la app de ML).
4. En WinSpy → **Ajustes → Competencia (MercadoLibre)** pulsa **«Conectar MercadoLibre»**
   y autoriza. El access/refresh token queda **cifrado en BD** (AES‑256‑GCM con
   `AUTH_SECRET`) y se **refresca solo** al expirar.
5. La saturación se mide con el botón **«Medir saturación»** (corre en el worker) y a
   diario vía `MELI_SATURATION_CRON`. El conteo se guarda en el producto y el score se
   recalcula. Los umbrales conteo→competencia (`mlLo`, `mlHi`, `mlWeight`) se ajustan
   en **Ajustes → reglas de oportunidad**.

| Variable | ¿Cuándo? | Qué |
|---|---|---|
| `MELI_CLIENT_ID` / `MELI_CLIENT_SECRET` | Opcional | Credenciales de la app de MercadoLibre (Vercel + Worker). |
| `MELI_REDIRECT_URI` | Opcional | URI de retorno del OAuth. Vacío = se deriva de `APP_URL`. Debe coincidir con la de la app de ML. |
| `MELI_SITE_ID` | Opcional | Sitio de ML (default `MCO` = Colombia). |
| `MELI_SATURATION_CRON` | Opcional | Patrón cron de la medición diaria (default `0 8 * * *`; vacío = off). |

> Sin conexión OAuth, la competencia degrada a «estimada» con solo la señal de Meta Ad
> Library CO (no falla). `AUTH_SECRET` debe ser el MISMO en Vercel y Railway: cifra y
> descifra los tokens; si difiere o se rota, hay que reconectar MercadoLibre.
