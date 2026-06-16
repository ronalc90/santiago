-- AlterTable
ALTER TABLE "products" ADD COLUMN     "shopifyUnitCost" INTEGER,
ADD COLUMN     "manualCost" INTEGER,
ADD COLUMN     "shippingCost" INTEGER,
ADD COLUMN     "costUpdatedAt" TIMESTAMP(3);
