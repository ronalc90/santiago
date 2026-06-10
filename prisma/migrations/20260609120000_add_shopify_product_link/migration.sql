-- AlterTable
ALTER TABLE "landing_projects" ADD COLUMN     "shopifyProductId" TEXT,
ADD COLUMN     "shopifyHandle" TEXT,
ADD COLUMN     "shopifyPublishedAt" TIMESTAMP(3),
ADD COLUMN     "shopifyPublishingAt" TIMESTAMP(3);
