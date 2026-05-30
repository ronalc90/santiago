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
# opcional: sembrar usuarios/ajustes iniciales
DATABASE_URL="postgresql://...direct...?sslmode=require" npm run db:seed
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
3. Variables de entorno: las MISMAS `DATABASE_URL` (pooled o direct), `REDIS_URL`,
   `IMAGE_PROVIDER`, `GEMINI_*`, `STORAGE_*` que en Vercel.
4. Deploy. El worker se conecta a la cola y procesa las landings.

> `postinstall` ejecuta `prisma generate` automáticamente en ambos servicios.
> `tsx` y `prisma` están en `dependencies` para que el worker arranque en prod.

## 6) Prueba de humo en producción

```bash
# login
curl -i -c ck.txt -X POST https://TU-APP.vercel.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"socio1@winspy.local","password":"changeme123"}'

# ingesta (usa tu INGEST_API_TOKEN de prod)
curl -X POST https://TU-APP.vercel.app/api/ads/ingest \
  -H 'Content-Type: application/json' -H 'x-ingest-token: TU_TOKEN' \
  -d '{"ads":[{"store_name":"Demo","country":"CO","ad_id":"PROD-1","ad_library_url":"https://www.facebook.com/ads/library/?id=PROD-1","days_active":10,"estimated_spend":20000}]}'
```

Luego, en la UI: crea producto → nueva landing → verifica que el worker genera las
9 imágenes y que el `.zip` descarga.
