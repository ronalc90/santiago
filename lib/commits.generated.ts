/* eslint-disable */
// AUTO-GENERADO por scripts/gen-commits.mjs — NO editar a mano.
// Regenerar tras nuevos commits: node scripts/gen-commits.mjs

export interface CommitEntry {
  hash: string;
  /** YYYY-MM-DD */
  date: string;
  subject: string;
}

export const COMMITS: CommitEntry[] = [
  {
    "hash": "e88373d",
    "date": "2026-06-22",
    "subject": "fix(landings+dropi): precios en COP correctos + diagnóstico claro de Shopify vacío"
  },
  {
    "hash": "555131d",
    "date": "2026-06-22",
    "subject": "feat(dropi): el catálogo se llena solo desde Shopify en cada búsqueda"
  },
  {
    "hash": "8510808",
    "date": "2026-06-22",
    "subject": "fix(dropi): «Con Dropi» no cruzaba — contención de nombres + lectura sin read_inventory"
  },
  {
    "hash": "263ad59",
    "date": "2026-06-22",
    "subject": "feat(dropi): sync diario del espejo Shopify + link al panel de Dropi"
  },
  {
    "hash": "10c6df2",
    "date": "2026-06-22",
    "subject": "feat(dropi): espejo del catálogo Dropi vía Shopify (automático)"
  },
  {
    "hash": "59cd90d",
    "date": "2026-06-22",
    "subject": "fix(dropi): camino por CSV; Dropi no autoriza API directa (confirmado por soporte)"
  },
  {
    "hash": "d5c1faf",
    "date": "2026-06-21",
    "subject": "fix(dropi): mensaje claro cuando el token está restringido por IP"
  },
  {
    "hash": "ade4431",
    "date": "2026-06-21",
    "subject": "fix(dropi): usar el endpoint real de Integraciones (catálogo ahora funciona)"
  },
  {
    "hash": "f3d78eb",
    "date": "2026-06-21",
    "subject": "feat(dropi): traer el catálogo de Dropi por API (automático) + sync y botón"
  },
  {
    "hash": "65a3b40",
    "date": "2026-06-21",
    "subject": "feat(ajustes): la versión es el número de commit (v0.N)"
  },
  {
    "hash": "92b73b7",
    "date": "2026-06-21",
    "subject": "feat(ajustes): versión por commit con explicación clara y fecha (actual: 2656)"
  },
  {
    "hash": "a019b66",
    "date": "2026-06-21",
    "subject": "fix(ui): dinero en COP, señales deducidas solo-lectura y guía de Dropi"
  },
  {
    "hash": "a90b853",
    "date": "2026-06-21",
    "subject": "feat(ajustes): changelog con TODAS las versiones y el historial completo de commits"
  },
  {
    "hash": "33b514b",
    "date": "2026-06-21",
    "subject": "feat(ui): modo lectura + tema configurable y persistente por usuario"
  },
  {
    "hash": "320bdb1",
    "date": "2026-06-21",
    "subject": "feat(ajustes): apartado \"Versión y cambios\" con changelog por versión"
  },
  {
    "hash": "e2eaed1",
    "date": "2026-06-20",
    "subject": "fix(oportunidades): tolerar reglas sin `cod` en el endpoint (compat pre-deploy)"
  },
  {
    "hash": "7145ad6",
    "date": "2026-06-17",
    "subject": "feat(oportunidades): Country/Cascade Score (winner global aún sin llegar a CO)"
  },
  {
    "hash": "55deb94",
    "date": "2026-06-17",
    "subject": "feat(scoring): Winner Score con techo de longevidad + margen efectivo COD"
  },
  {
    "hash": "33a23b8",
    "date": "2026-06-16",
    "subject": "feat(ui): prompts por imagen (9), página de Ayuda y modo claro/oscuro"
  },
  {
    "hash": "1504e14",
    "date": "2026-06-16",
    "subject": "feat(oportunidades): fotos en candidatos ML + progreso en vivo + Ver landing"
  },
  {
    "hash": "09f52d8",
    "date": "2026-06-16",
    "subject": "fix(descubrimiento): hallazgos de la revisión adversarial de Fase B·2"
  },
  {
    "hash": "578d219",
    "date": "2026-06-16",
    "subject": "feat(oportunidades): Fase B·2 completa (Trends, Apify Meta/TikTok, embeddings, Dropi CSV, creativos)"
  },
  {
    "hash": "e40075f",
    "date": "2026-06-16",
    "subject": "fix(descubrimiento): hallazgos de la revisión + limpieza de código muerto"
  },
  {
    "hash": "6f54bc6",
    "date": "2026-06-16",
    "subject": "feat(oportunidades): descubrimiento de productos ganadores (Fase B·1, núcleo gratis)"
  },
  {
    "hash": "6ddeef5",
    "date": "2026-06-16",
    "subject": "feat(spy): buscar anuncios por país/término + ingesta automática multi-país"
  },
  {
    "hash": "50a652b",
    "date": "2026-06-16",
    "subject": "fix(meli): medir saturación con /products/search (el /sites/search da 403)"
  },
  {
    "hash": "bd66122",
    "date": "2026-06-16",
    "subject": "fix(spy): un anuncio CO no puede ser \"creativo extranjero sin usar en CO\""
  },
  {
    "hash": "82e9924",
    "date": "2026-06-16",
    "subject": "fix(meli): diagnóstico claro cuando falta refresh_token (offline_access)"
  },
  {
    "hash": "e635fe4",
    "date": "2026-06-16",
    "subject": "fix(meli): pedir scope offline_access para recibir refresh_token"
  },
  {
    "hash": "30aa901",
    "date": "2026-06-16",
    "subject": "fix(meli): exponer el error real del intercambio en la URL + no reintentar el code"
  },
  {
    "hash": "bbecfe9",
    "date": "2026-06-16",
    "subject": "fix(meli): diagnosticar el fallo del callback (motivo + error real de ML)"
  },
  {
    "hash": "4c3a871",
    "date": "2026-06-16",
    "subject": "docs(guía): manual de usuario de WinSpy con capturas"
  },
  {
    "hash": "5d8e74e",
    "date": "2026-06-16",
    "subject": "fix(meli): blindar APP_URL en producción y diagnosticar el OAuth"
  },
  {
    "hash": "12e6413",
    "date": "2026-06-16",
    "subject": "fix(worker): arrancar bajo tsx resolviendo server-only (react-server)"
  },
  {
    "hash": "7554832",
    "date": "2026-06-16",
    "subject": "feat(competencia): medir saturación en MercadoLibre por OAuth para el score"
  },
  {
    "hash": "39624b1",
    "date": "2026-06-16",
    "subject": "fix(spy): un anuncio del Ad Library de CO cuenta como \"se vende en CO\""
  },
  {
    "hash": "d55438a",
    "date": "2026-06-16",
    "subject": "feat(costos): leer el costo por artículo desde Shopify para el margen"
  },
  {
    "hash": "8185e9b",
    "date": "2026-06-10",
    "subject": "feat(landings): landing HTML de ventas + remates del motor de oportunidad"
  },
  {
    "hash": "7dccdb3",
    "date": "2026-06-09",
    "subject": "feat(oportunidad): motor de oportunidad 4×25 por producto (Fase A)"
  },
  {
    "hash": "836deb4",
    "date": "2026-06-09",
    "subject": "feat(settings): prompts de IA editables desde Ajustes (#9)"
  },
  {
    "hash": "2ebcab8",
    "date": "2026-06-09",
    "subject": "feat(shopify): publicar la landing como producto por Admin API (en un clic)"
  },
  {
    "hash": "1828c85",
    "date": "2026-06-09",
    "subject": "feat(landings): exportar la landing como producto de Shopify (CSV)"
  },
  {
    "hash": "37ce0c5",
    "date": "2026-06-05",
    "subject": "docs: guía de usuario simple (no técnica) para el dueño"
  },
  {
    "hash": "f82ad61",
    "date": "2026-06-05",
    "subject": "feat(spy/landings): score por longevidad, regenerar landing, saneo de ingesta y paginación"
  },
  {
    "hash": "d971373",
    "date": "2026-06-05",
    "subject": "fix(ci): fijar Railway CLI a v4 (la v5 rompe railway up con token de proyecto)"
  },
  {
    "hash": "61e14bd",
    "date": "2026-06-05",
    "subject": "chore(ci): redeploy de verificación tras limpiar el worker duplicado"
  },
  {
    "hash": "9763e4a",
    "date": "2026-06-05",
    "subject": "fix(responsive): navegación móvil + ajustes en todas las vistas"
  },
  {
    "hash": "3ac3c3f",
    "date": "2026-06-05",
    "subject": "docs(env): aclarar que TEXT_PROVIDER=mock queda prohibido en producción"
  },
  {
    "hash": "20cf3bf",
    "date": "2026-06-04",
    "subject": "fix(auditoría): defectos de IA, scoring y UX de productos"
  },
  {
    "hash": "e11192a",
    "date": "2026-06-04",
    "subject": "fix(auditoría): críticos + quick wins de seguridad/robustez"
  },
  {
    "hash": "5fbad43",
    "date": "2026-06-04",
    "subject": "fix(prisma): binaryTargets rhel-openssl-3.0.x para el runtime de Vercel"
  },
  {
    "hash": "c7a77e8",
    "date": "2026-06-04",
    "subject": "fix(login): quitar rate-limit con ioredis que tumbaba el login en Vercel (500)"
  },
  {
    "hash": "f8f0f3a",
    "date": "2026-06-04",
    "subject": "fix(worker): forzar IPv4 para descargar creativos (Railway sin ruta IPv6)"
  },
  {
    "hash": "6234cd4",
    "date": "2026-06-04",
    "subject": "fix(middleware): permitir /api/ads/sync con x-ingest-token (no redirigir a login)"
  },
  {
    "hash": "7f22854",
    "date": "2026-06-04",
    "subject": "ci(deploy): asegurar admin en el pipeline + ignorar .env.deploy/.vercel"
  },
  {
    "hash": "96a5419",
    "date": "2026-05-30",
    "subject": "fix(prod): eliminar datos demo y cerrar bloqueadores de producción"
  },
  {
    "hash": "665b786",
    "date": "2026-05-30",
    "subject": "fix(scoring): Winner Score útil con datos reales (sin gasto de Meta)"
  },
  {
    "hash": "e58cecb",
    "date": "2026-05-30",
    "subject": "feat(costos): apartado de costos COP/USD + botón sincronizar anuncios reales"
  },
  {
    "hash": "7113973",
    "date": "2026-05-30",
    "subject": "Merge pull request #3 from ronalc90/feat/ads-reales-meta-ad-library"
  },
  {
    "hash": "9dcade2",
    "date": "2026-05-30",
    "subject": "feat(spy): anuncios reales de Meta Ad Library vía Apify"
  },
  {
    "hash": "02aa85f",
    "date": "2026-05-30",
    "subject": "feat(landings): visor de imágenes a pantalla completa"
  },
  {
    "hash": "f6fc305",
    "date": "2026-05-30",
    "subject": "feat: generación de textos con OpenAI (sugerir producto y copy de landing) (#2)"
  },
  {
    "hash": "0520f14",
    "date": "2026-05-30",
    "subject": "fix(lint): eliminar por completo `any` y eslint-disable de gemini.ts"
  },
  {
    "hash": "01dfa20",
    "date": "2026-05-30",
    "subject": "fix(lint): tipar la respuesta de Gemini sin `any` (build de Vercel)"
  },
  {
    "hash": "3e40070",
    "date": "2026-05-30",
    "subject": "chore: railway.json para el worker (npm run worker)"
  },
  {
    "hash": "a9d5b01",
    "date": "2026-05-30",
    "subject": "Producción: build Vercel verde, Gemini por REST, error pages y deps de build"
  },
  {
    "hash": "44f683a",
    "date": "2026-05-30",
    "subject": "fix(build): fijar Node 20 — el prerender fallaba solo en Node 18"
  },
  {
    "hash": "ff9cc91",
    "date": "2026-05-30",
    "subject": "Producción: build verde, error pages App Router y config de despliegue"
  },
  {
    "hash": "c5cccb5",
    "date": "2026-05-30",
    "subject": "Importación inicial de WinSpy: spy de anuncios, generador de landings y dashboard"
  }
];
