# WinSpy — Plataforma interna de e-commerce / dropshipping

Plataforma web interna que unifica tres módulos en una sola app:

1. **Spy de anuncios** — repositorio y análisis de productos ganadores detectados en Meta Ad Library.
2. **Generador de landings** — genera 9 imágenes de página de ventas con IA (Google Gemini), texto en español.
3. **Dashboard** — KPIs, pipeline de producto y gestión de tiendas/productos.

Uso interno para 2 socios, pero el código está preparado para escalar a multiusuario (modelo `User` con `role`).

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (modo oscuro) |
| Backend | Next.js API routes (route handlers) + TypeScript |
| Base de datos | PostgreSQL + Prisma ORM (migraciones incluidas) |
| Auth | email/password con sesiones en BD (cookie httpOnly), roles ADMIN/MEMBER |
| Cola de trabajos | BullMQ + Redis (worker en proceso separado) |
| Imágenes | Google Gemini (configurable) con compresión a WebP (`sharp`) |
| Almacenamiento | Adaptador local (dev) o S3/R2 (prod), seleccionable por env |

### Arquitectura por capas

```
app/            UI (Server/Client Components) + route handlers (API)
lib/services/   Lógica de negocio (scoring, ads, landing, settings)  ← testeable
lib/validation/ Esquemas zod (validación de entrada)
lib/auth/       Sesiones, guards, hashing
lib/images/     Generador de imágenes (interfaz + Gemini + mock) y compresión
lib/storage/    Adaptador de almacenamiento (interfaz + local + s3)
lib/queue/      Cola BullMQ (productor)
lib/db.ts       Acceso a datos (Prisma)
worker/         Consumidor de la cola (proceso separado)
prisma/         Esquema, migraciones y seed
tests/          Tests de la lógica crítica (vitest)
```

La restricción clave del negocio se respeta: **el scraping en vivo de Meta lo hace una skill externa en Claude in Chrome**. El backend solo **recibe** los datos por el endpoint de ingesta o el importador manual; nunca scrapea Facebook.

---

## Requisitos

- Node.js 20+ (probado en Node 22)
- Docker + Docker Compose (para Postgres y Redis)
- npm

---

## Instalación y arranque (desarrollo)

```bash
# 1) Variables de entorno
cp .env.example .env       # (ya hay un .env listo para dev; revísalo)

# 2) Levantar Postgres y Redis
docker compose up -d

# 3) Instalar dependencias
npm install

# 4) Migraciones + cliente Prisma + datos de ejemplo
npm run db:migrate         # crea las tablas (primera vez: nombra la migración, p.ej. "init")
npm run db:seed            # carga usuarios, tiendas, anuncios y una landing demo

# 5) Levantar la app (terminal 1)
npm run dev                # http://localhost:3000

# 6) Levantar el worker de imágenes (terminal 2)
npm run worker
```

### Usuarios de ejemplo (seed)

| Email | Clave | Rol |
|-------|-------|-----|
| `socio1@winspy.local` | `changeme123` | ADMIN |
| `socio2@winspy.local` | `changeme123` | MEMBER |

---

## Variables de entorno

Ver `.env.example` (documentado). Las más importantes:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `REDIS_URL` | Conexión a Redis (cola BullMQ) |
| `AUTH_SECRET` | Secreto de sesiones (genera: `openssl rand -base64 32`) |
| `INGEST_API_TOKEN` | Token que la skill del spy envía en el header `x-ingest-token` |
| `IMAGE_PROVIDER` | `mock` (placeholders, sin costo) o `gemini` (API real) |
| `GEMINI_API_KEY` | Clave de la API de Gemini |
| `GEMINI_IMAGE_MODEL` | Modelo de generación de imágenes (nano banana). **Confírmalo** con tu cuenta |
| `GEMINI_TEXT_MODEL` | Modelo de texto/visión para analizar la imagen de referencia |
| `STORAGE_DRIVER` | `local` o `s3` |

> **Validación:** `lib/config/env.ts` valida todas las variables al arrancar y falla con mensajes claros si falta algo. Ningún módulo lee `process.env` directamente.

### Probar la conexión a Gemini

```bash
npx tsx scripts/test-gemini.ts
```

Confirma que la key responde y que el nombre del modelo es válido **antes** de poner `IMAGE_PROVIDER=gemini`. Para imágenes, ajusta `GEMINI_IMAGE_MODEL` al modelo de imagen (nano banana) al que tu key tenga acceso.

---

## Ingesta de datos del spy

La skill de Claude in Chrome envía los anuncios al endpoint de ingesta:

```bash
curl -X POST http://localhost:3000/api/ads/ingest \
  -H "Content-Type: application/json" \
  -H "x-ingest-token: <INGEST_API_TOKEN>" \
  -d '{
    "ads": [{
      "store_name": "GadgetPro CO",
      "country": "CO",
      "ad_id": "AD-CO-9001",
      "ad_library_url": "https://www.facebook.com/ads/library/?id=AD-CO-9001",
      "copy_text": "Producto ganador…",
      "days_active": 12,
      "estimated_spend": 18000,
      "creative_url": "https://…/img.jpg"
    }]
  }'
```

También puedes **importar manualmente** (pegar JSON o CSV, o subir archivo) desde la UI: Spy → *Importar resultados del spy*. La **deduplicación es por `ad_id`** (reingestar el mismo anuncio actualiza métricas y lo marca como histórico).

---

## Lógica de negocio

- **Winner Score** = `gasto estimado / días activos` (intensidad de inversión diaria).
- **Clasificación** automática y configurable desde *Ajustes*:
  - 🔴 **LANZAR** (score ≥ umbral alto)
  - 🟡 **CONSIDERAR** (score medio)
  - 🟢 **MONITOREAR** (señal temprana)
  - ⚪ **SATURADO** (demasiados días activo)
- Al guardar nuevas reglas, **todos los anuncios se reclasifican** automáticamente.

---

## Scripts npm

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | App en desarrollo |
| `npm run worker` | Worker de generación de imágenes |
| `npm run build` | `prisma generate` + build de producción |
| `npm start` | App en producción |
| `npm test` | Tests (vitest) |
| `npm run db:migrate` | Migraciones de desarrollo |
| `npm run db:deploy` | Migraciones en producción |
| `npm run db:seed` | Datos de ejemplo |
| `npm run db:studio` | Prisma Studio (explorar la BD) |
| `npm run db:reset` | Resetea la BD (¡borra datos!) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

---

## Tests

```bash
npm test
```

Cubren la lógica crítica: cálculo del Winner Score, clasificación por reglas (incluyendo límites y reglas personalizadas), señal de demanda en otro país, validación/normalización de la ingesta y la especificación de las 9 imágenes (incl. compliance TikTok). 23 tests.

---

## Despliegue a producción (Vercel + worker en Railway)

Vercel corre en serverless y **no puede ejecutar el worker persistente** de BullMQ. Por eso:

1. **Web/API → Vercel.** Importa el repo, define las variables de entorno (usa Postgres gestionado tipo Neon y Redis tipo Upstash). Vercel ejecuta `npm run build`.
2. **Worker → Railway/Render.** Despliega el mismo repo como servicio con comando de inicio `npm run worker`, apuntando al **mismo** `DATABASE_URL` y `REDIS_URL`.
3. **Almacenamiento → S3/R2.** Pon `STORAGE_DRIVER=s3`, instala `@aws-sdk/client-s3` y rellena las `S3_*`. (El adaptador local solo sirve para dev.)
4. Migraciones en prod: `npm run db:deploy`.

La cola está detrás de una abstracción (`lib/queue`), así que se puede cambiar el destino sin tocar la lógica de negocio.

---

## Seguridad

- Validación de entrada con **zod** en todos los endpoints.
- Secretos solo por entorno; nada hardcodeado. El `.env` está en `.gitignore`.
- Contraseñas con **bcrypt**; sesiones opacas en BD con expiración.
- Ingesta protegida por token con comparación en **tiempo constante**.
- Rutas protegidas por middleware + verificación real en cada Server Component / route handler.
- Manejo de errores con `try/catch` y mensajes claros en toda llamada externa (Gemini, ingesta, importación).

---

## Notas de verificación

- Esquema Prisma validado y cliente generado correctamente.
- Lógica de negocio con typecheck `strict` en verde y 23 tests pasando.
- Revisión de código de la UI/API (imports, exports, tipos de props, Server/Client Components) sin errores que rompan el build.
- El `next build` final se ejecuta en tu máquina al correr `npm install && npm run dev`.
