-- Estado del candidato en el embudo de descubrimiento.
CREATE TYPE "CandidateStatus" AS ENUM ('NUEVO', 'REVISADO', 'DESCARTADO', 'CONVERTIDO');

-- Candidatos descubiertos (deduplicados por nombre normalizado).
CREATE TABLE "opportunity_candidates" (
  "id" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "countries" TEXT[],
  "sources" TEXT[],
  "interest" INTEGER,
  "salesCount" INTEGER,
  "listingsCount" INTEGER,
  "daysActive" INTEGER,
  "enCO" BOOLEAN NOT NULL DEFAULT false,
  "saturationCO" INTEGER,
  "dropiStatus" "DropiAvailability" NOT NULL DEFAULT 'DESCONOCIDO',
  "dropiRef" TEXT,
  "score4x25" DOUBLE PRECISION,
  "scoreBand" "OpportunityBand",
  "breakdown" JSONB,
  "status" "CandidateStatus" NOT NULL DEFAULT 'NUEVO',
  "productId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opportunity_candidates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "opportunity_candidates_normalizedName_key" ON "opportunity_candidates"("normalizedName");
CREATE INDEX "opportunity_candidates_status_idx" ON "opportunity_candidates"("status");
CREATE INDEX "opportunity_candidates_score4x25_idx" ON "opportunity_candidates"("score4x25");
CREATE INDEX "opportunity_candidates_enCO_idx" ON "opportunity_candidates"("enCO");

-- Creativos (galería) de cada candidato.
CREATE TABLE "opportunity_creatives" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "country" TEXT,
  "source" TEXT NOT NULL,
  "storageKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opportunity_creatives_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "opportunity_creatives_candidateId_idx" ON "opportunity_creatives"("candidateId");
ALTER TABLE "opportunity_creatives"
  ADD CONSTRAINT "opportunity_creatives_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "opportunity_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Catálogo de Dropi importado por CSV (Dropi no da API a terceros).
CREATE TABLE "dropi_catalog_items" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "sku" TEXT,
  "category" TEXT,
  "cost" INTEGER,
  "stock" INTEGER,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dropi_catalog_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dropi_catalog_items_normalizedName_key" ON "dropi_catalog_items"("normalizedName");
CREATE INDEX "dropi_catalog_items_category_idx" ON "dropi_catalog_items"("category");
