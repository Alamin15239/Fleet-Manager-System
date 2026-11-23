-- Add supplier/purchase metadata and structured tire inspection measurements.
-- Safe to run repeatedly; legacy records remain unchanged and nullable.
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "supplierName" TEXT;
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "purchaseReference" TEXT;
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "purchaseCost" DOUBLE PRECISION;

ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "treadDepthMm" DOUBLE PRECISION;
ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "pressurePsi" DOUBLE PRECISION;
ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "condition" TEXT;
ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "inspectionDueAt" TIMESTAMP(3);
ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "damageLocation" TEXT;
ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "evidenceUrl" TEXT;
ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "supplierName" TEXT;
ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "purchaseReference" TEXT;
ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "purchaseCost" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "tire_lifecycle_events_inspectionDueAt_idx"
  ON "tire_lifecycle_events" ("inspectionDueAt")
  WHERE "eventType" = 'INSPECT';
CREATE INDEX IF NOT EXISTS "tires_supplierName_idx" ON "tires" ("supplierName");
