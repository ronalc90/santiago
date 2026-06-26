-- Serie temporal de anuncios (una foto por sincronización) para medir Velocity.
CREATE TABLE "ad_snapshots" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "winnerScore" DOUBLE PRECISION NOT NULL,
    "daysActive" INTEGER NOT NULL,
    "estimatedSpend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "classification" "AdClassification" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ad_snapshots_adId_capturedAt_idx" ON "ad_snapshots"("adId", "capturedAt");

ALTER TABLE "ad_snapshots" ADD CONSTRAINT "ad_snapshots_adId_fkey" FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
