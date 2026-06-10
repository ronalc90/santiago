-- CreateEnum
CREATE TYPE "OpportunityBand" AS ENUM ('EXCELENTE', 'MUY_BUENO', 'BUENO', 'RIESGOSO', 'RECHAZAR', 'SIN_DATOS');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "salePrice" INTEGER,
ADD COLUMN     "opportunityScore" DOUBLE PRECISION,
ADD COLUMN     "opportunityBand" "OpportunityBand",
ADD COLUMN     "opportunityConfidence" DOUBLE PRECISION,
ADD COLUMN     "opportunityEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "demandScore" INTEGER,
ADD COLUMN     "competitionScore" INTEGER,
ADD COLUMN     "marginScore" INTEGER,
ADD COLUMN     "creativesScore" INTEGER,
ADD COLUMN     "opportunityBreakdown" JSONB,
ADD COLUMN     "opportunityComputedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_opportunityScore_idx" ON "products"("opportunityScore");

-- CreateIndex
CREATE INDEX "products_opportunityBand_idx" ON "products"("opportunityBand");
