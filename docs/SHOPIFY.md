# Publicar landings en Shopify (Admin API)

WinSpy puede **crear el producto directamente en tu tienda Shopify** desde el detalle
de una landing (botón **"Publicar en Shopify"**). Mientras no configures las
credenciales, el botón queda desactivado y nada se rompe.

## 1. Crear una Custom App en Shopify

1. En tu admin de Shopify: **Configuración → Apps y canales de venta → Desarrollar apps**.
   (Si es la primera vez, pulsa **"Permitir el desarrollo de apps personalizadas"**.)
2. **Crear una app** → ponle un nombre (p. ej. `WinSpy`).
3. Pestaña **Configuración de Admin API** → en **Permisos (scopes)** marca **`write_products`**
   (y `read_products`). Guarda.
4. Pestaña **Credenciales de API** → **Instalar app** → copia el
   **Admin API access token** (empieza por `shpat_…`). **Se muestra una sola vez.**

> El **dominio** que necesitas es el permanente `tu-tienda.myshopify.com` (no tu dominio
> propio). Lo ves en la barra de direcciones del admin.

## 2. Configurar las variables (en Vercel)

La publicación corre en la web (Vercel), no en el worker. Añade en el proyecto de Vercel:

| Variable | Valor |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `tu-tienda.myshopify.com` |
| `SHOPIFY_ADMIN_TOKEN` | `shpat_…` (secreto) |
| `SHOPIFY_API_VERSION` | `2025-10` (por defecto; opcional) |
| `SHOPIFY_PUBLISH_STATUS` | `draft` (recomendado) o `active` |

Vuelve a desplegar para que tomen efecto. **Importante:** las imágenes deben servirse por
**https público** (R2 / `STORAGE_DRIVER=s3` con `S3_PUBLIC_BASE_URL` https); Shopify las
descarga por URL y el almacenamiento local (http) no le sirve.

## 3. Usar

En el detalle de una landing terminada: **Publicar en Shopify** → confirma. Se crea el
producto (como **borrador** por defecto) con las 9 imágenes y la página de ventas como
descripción. Luego aparece **"Ver en Shopify"** para abrirlo, revisarlo y publicarlo desde
tu tienda. Es **idempotente**: volver a pulsar no crea duplicados.

> Notas: el producto se crea con **1 variante** y precio = oferta (precio tachado = regular).
> Shopify ingiere las imágenes de forma asíncrona; si alguna no carga, revisa que su URL
> R2 sea pública y permanente.
