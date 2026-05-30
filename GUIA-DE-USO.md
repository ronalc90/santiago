# Guía de uso — WinSpy (1 página)

## Arrancar (primera vez)

```bash
docker compose up -d           # Postgres + Redis
npm install
npm run db:migrate             # escribe "init" como nombre de migración
npm run db:seed                # datos de ejemplo
npm run dev                    # http://localhost:3000  (terminal 1)
npm run worker                 # worker de imágenes      (terminal 2)
```

Entra con **socio1@winspy.local / changeme123**.

## Flujo de trabajo diario

1. **Spy → Importar resultados del spy.** Pega el JSON/CSV que produjo la skill de Claude in Chrome (o usa el endpoint `/api/ads/ingest`). Se deduplica por `ad_id`.
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
