-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AdClassification" AS ENUM ('LANZAR', 'CONSIDERAR', 'MONITOREAR', 'SATURADO');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DETECTADO', 'VALIDADO', 'LANDING_CREADA', 'LANZADO', 'ESCALANDO');

-- CreateEnum
CREATE TYPE "DropiAvailability" AS ENUM ('DISPONIBLE', 'NO_DISPONIBLE', 'A_IMPORTAR', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "LandingStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('GENERATE_LANDING', 'GENERATE_IMAGE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adLibraryUrl" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "storeId" TEXT,
    "storeName" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CO',
    "adLibraryUrl" TEXT NOT NULL,
    "copyText" TEXT,
    "creativeUrl" TEXT,
    "daysActive" INTEGER NOT NULL DEFAULT 0,
    "estimatedSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winnerScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classification" "AdClassification" NOT NULL DEFAULT 'MONITOREAR',
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "sellsInColombia" BOOLEAN NOT NULL DEFAULT false,
    "hasUnusedForeignCreative" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DETECTADO',
    "market" TEXT NOT NULL DEFAULT 'CO',
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "sellsInColombia" BOOLEAN NOT NULL DEFAULT false,
    "hasUnusedForeignCreative" BOOLEAN NOT NULL DEFAULT false,
    "dropiAvailability" "DropiAvailability" NOT NULL DEFAULT 'DESCONOCIDO',
    "notes" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_projects" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "styleAnalysis" JSONB,
    "productPhotoKey" TEXT,
    "referenceImageKey" TEXT,
    "complianceTiktok" BOOLEAN NOT NULL DEFAULT false,
    "status" "LandingStatus" NOT NULL DEFAULT 'DRAFT',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_images" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "promptEn" TEXT,
    "storageKey" TEXT,
    "url" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "status" "ImageStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "projectId" TEXT,
    "bullJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_name_country_key" ON "stores"("name", "country");

-- CreateIndex
CREATE UNIQUE INDEX "ads_adId_key" ON "ads"("adId");

-- CreateIndex
CREATE INDEX "ads_storeId_idx" ON "ads"("storeId");

-- CreateIndex
CREATE INDEX "ads_classification_idx" ON "ads"("classification");

-- CreateIndex
CREATE INDEX "ads_winnerScore_idx" ON "ads"("winnerScore");

-- CreateIndex
CREATE INDEX "ads_country_idx" ON "ads"("country");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_market_idx" ON "products"("market");

-- CreateIndex
CREATE INDEX "landing_projects_productId_idx" ON "landing_projects"("productId");

-- CreateIndex
CREATE INDEX "landing_projects_status_idx" ON "landing_projects"("status");

-- CreateIndex
CREATE INDEX "landing_images_projectId_idx" ON "landing_images"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "landing_images_projectId_slot_key" ON "landing_images"("projectId", "slot");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_projectId_idx" ON "jobs"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_projects" ADD CONSTRAINT "landing_projects_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_images" ADD CONSTRAINT "landing_images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "landing_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "landing_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
