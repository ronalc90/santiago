# CI/CD — Despliegue automático

GitHub Actions controla el despliegue de **producción al 100%**. En cada push a `main`
se ejecuta `.github/workflows/deploy.yml`:

```
typecheck → build (Vercel) → migraciones (Neon) → Web (Vercel) → Worker (Railway)
```

Si un paso falla, los siguientes no corren: la base de datos y los servicios solo se
tocan cuando el código compila. En Pull Requests corre `ci.yml` (typecheck + build, sin desplegar).

---

## 1) Secretos del repositorio

En GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Secreto | De dónde sacarlo |
|---|---|
| `VERCEL_TOKEN` | Vercel → **Account Settings → Tokens** → crear token. |
| `RAILWAY_TOKEN` | Railway → tu proyecto → **Settings → Tokens** → *Project Token*. |
| `DATABASE_URL` | Neon → cadena **Direct** (sin `-pooler`), con `?sslmode=require`. Se usa solo para `prisma migrate deploy`. |

> Los IDs de Vercel (`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) ya están en `deploy.yml`
> como variables normales (no son secretos: sin el token no sirven).

O más rápido, desde la terminal con el CLI de GitHub:

```bash
gh secret set VERCEL_TOKEN   --repo ronalc90/santiago   # pega el token de Vercel
gh secret set RAILWAY_TOKEN  --repo ronalc90/santiago   # pega el Project Token de Railway
gh secret set DATABASE_URL   --repo ronalc90/santiago   # pega la cadena DIRECT de Neon
```

## 2) Variable opcional del worker

En **Settings → Secrets and variables → Actions → Variables → New repository variable**:

| Variable | Valor |
|---|---|
| `RAILWAY_SERVICE` | Nombre del servicio del worker en Railway (ej. `worker`). Opcional si el proyecto tiene un solo servicio. |

```bash
gh variable set RAILWAY_SERVICE --repo ronalc90/santiago --body "worker"  # ajusta el nombre
```

## 3) Desactivar el auto-deploy nativo (evita despliegues duplicados)

Como Actions ahora despliega, hay que apagar el auto-deploy por Git de las plataformas:

- **Vercel**: ya está desactivado para `main` vía `vercel.json` (`git.deploymentEnabled`).
  No tienes que hacer nada.
- **Railway**: servicio del worker → **Settings → Source** → desactiva
  *Automatic Deployments* (o desconecta el repo). El worker se desplegará solo con
  `railway up` desde Actions.

## 4) Variables de entorno de los servicios (una sola vez)

Estas NO van en GitHub; viven en cada plataforma y se inyectan en runtime:

- **Vercel** (Web/API): todas las de `.env.production.example` (`APP_URL`, `DATABASE_URL`
  *pooled*, `REDIS_URL`, `AUTH_SECRET`, `INGEST_API_TOKEN`, `IMAGE_PROVIDER`, `GEMINI_*`,
  `TEXT_PROVIDER`/`OPENAI_*`, `STORAGE_*`, `USD_COP_RATE`, …). Ver `DEPLOY.md`.
- **Railway** (Worker): `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `INGEST_API_TOKEN`
  (sin estas dos últimas el worker **crashea al arrancar**), el bloque de anuncios
  reales (`AD_SOURCE_PROVIDER="apify"`, `APIFY_TOKEN`, `APIFY_ACTOR_ID`,
  `AD_SOURCE_COUNTRY`, `AD_SOURCE_KEYWORDS`, `AD_SOURCE_LIMIT`, `AD_SOURCE_CRON`),
  `IMAGE_PROVIDER`/`GEMINI_*` y `STORAGE_DRIVER="s3"`+`S3_*`. El worker es quien llama
  a Apify y a Gemini, así que estas vars van EN EL WORKER. Detalle completo en `DEPLOY.md`.

## 5) Probar

```bash
git commit --allow-empty -m "ci: probar pipeline de despliegue"
git push origin main
```

Mira el progreso en la pestaña **Actions** del repo. El enlace de la web desplegada
aparece en el *Summary* del run.

---

### Notas

- Las migraciones se aplican automáticamente antes de cada deploy. Usa migraciones
  **aditivas** (no destructivas) para que el código viejo y el nuevo convivan durante
  el corte. Crea migraciones con `npm run db:migrate` en local y commitéalas.
- `workflow_dispatch` permite relanzar el despliegue a mano desde la pestaña Actions.
- El job usa la versión de Node de `.nvmrc` (20).
