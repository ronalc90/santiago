-- Resultados reales del producto (loop de validación; los ingresa el usuario).
ALTER TABLE "products" ADD COLUMN "realRoas" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN "realCpa" INTEGER;
ALTER TABLE "products" ADD COLUMN "realUnitsSold" INTEGER;
ALTER TABLE "products" ADD COLUMN "realReturnRate" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN "resultUpdatedAt" TIMESTAMP(3);
