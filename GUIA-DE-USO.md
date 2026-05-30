# Guía de uso — WinSpy (1 página)

## Arrancar (primera vez)

```bash
docker compose up -d           # Postgres + Redis
npm install
npm run db:migrate             # escribe "init" como nombre de migración
npm run db:seed                # datos de ejemplo (solo desarrollo)
npm run dev                    # http://localhost:3000  (terminal 1)
npm run worker                 # worker de imágenes      (terminal 2)
```

Entra con el admin creado por **`ADMIN_EMAIL` / `ADMIN_PASSWORD`**. En desarrollo,
`ADMIN_EMAIL` trae un default; si no defines `ADMIN_PASSWORD`, se genera una clave
aleatoria fuerte y se imprime por consola al crear el admin (cópiala de ahí).

## Flujo de trabajo diario

1. **Spy → traer anuncios reales.** Dos caminos:
   - **Sincronizar reales** (botón arriba de la tabla, o `POST /api/ads/sync`): el worker consulta el Meta Ad Library vía Apify usando `AD_SOURCE_COUNTRY`/`AD_SOURCE_KEYWORDS`/`AD_SOURCE_LIMIT`. Requiere `AD_SOURCE_PROVIDER="apify"` + `APIFY_TOKEN` en el worker; si no, devuelve datos demo.
   - **Importar resultados del spy**: pega el JSON/CSV de la skill de Claude in Chrome (o usa el endpoint `/api/ads/ingest`).
   En ambos casos se deduplica por `ad_id`.
2. **Spy.** Revisa la tabla ordenada por **Winner Score**. Filtra por clasificación (🔴🟡🟢⚪), por “+días activos”, por “creativo extranjero sin usar en CO”, o por “no se vende en CO”. Cambia entre **Históricos** y **Solo nuevos**.
3. **Detalle de un anuncio.** Revisa copy, creativo, link directo a la Ad Library e historial. Marca las señales del negocio y pulsa **Crear producto desde este anuncio**.
4. **Producto.** Ajusta etapa del pipeline, disponibilidad en Dropi, notas. Desde aquí lanza **Nueva landing**.
5. **Nueva landing (asistente 3 pasos).** Datos del producto y oferta → foto del producto + imagen de referencia de estilo + *Compliance TikTok* → **Generar 9 imágenes**. La generación corre en cola; verás la **barra de progreso**.
6. **Detalle de landing.** Previsualiza las 9 imágenes, **regenera** las que quieras y **descarga el .zip** (WebP listo para Shopify).
7. **Dashboard.** KPIs, pipeline visual (Detectado → Validado → Landing → Lanzado → Escalando), top winners y productos por mercado.
8. **Ajustes.** Cambia los umbrales del Winner Score; al guardar se reclasifican todos los anuncios.

## Imágenes con IA

- Por defecto `IMAGE_PROVIDER=mock` genera placeholders (sin costo) para probar todo el flujo.
- Para usar Gemini real: `npx tsx scripts/test-gemini.ts` para validar key/modelo, ajusta `GEMINI_IMAGE_MODEL`, pon `IMAGE_PROVIDER=gemini` y reinicia app + worker.

## Tiendas

**Tiendas** → CRUD de competidoras (nombre, país, URL de Ad Library). Cada anuncio ingestado se liga automáticamente a su tienda.

## Problemas comunes

- *“No conecta a la BD / Redis”* → ¿está `docker compose up -d` corriendo?
- *“Las landings se quedan en cola”* → falta `npm run worker` en otra terminal.
- *“Token de ingesta inválido”* → el header `x-ingest-token` debe igualar `INGEST_API_TOKEN` del `.env`.
