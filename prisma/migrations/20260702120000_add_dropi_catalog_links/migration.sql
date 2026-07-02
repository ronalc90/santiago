-- Enlace directo a la ficha del producto en Dropi (cuando el CSV trae id/url).
ALTER TABLE "dropi_catalog_items" ADD COLUMN "dropiId" TEXT;
ALTER TABLE "dropi_catalog_items" ADD COLUMN "dropiUrl" TEXT;
