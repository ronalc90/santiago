-- Saturación de MercadoLibre por producto (la mide el worker; alimenta la
-- dimensión "Competencia Colombia" del motor de oportunidad).
ALTER TABLE "products"
  ADD COLUMN "saturationCount" INTEGER,
  ADD COLUMN "saturationUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "saturationKeyword" TEXT;

-- Tokens OAuth de integraciones externas (MercadoLibre). access/refresh cifrados.
CREATE TABLE "oauth_tokens" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "scope" TEXT,
  "externalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_tokens_provider_key" ON "oauth_tokens"("provider");
