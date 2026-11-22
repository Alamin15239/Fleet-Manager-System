-- Durable tire lifecycle history and maintenance-to-job-card relationships.
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "internalCode" TEXT;
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'STOCK';
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "currentPosition" TEXT;
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMP(3);
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "installationOdometer" INTEGER;
ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE SEQUENCE IF NOT EXISTS "tire_internal_code_seq";
UPDATE "tires"
SET "internalCode" = 'TY-' || LPAD(nextval('"tire_internal_code_seq"')::text, 6, '0')
WHERE "internalCode" IS NULL;
UPDATE "tires"
SET "lifecycleStatus" = 'INSTALLED', "installedAt" = COALESCE("installedAt", "createdAt")
WHERE "lifecycleStatus" = 'STOCK'
  AND ("truckId" IS NOT NULL OR NULLIF("trailerNumber", '') IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "tires_internalCode_key" ON "tires" ("internalCode");
CREATE UNIQUE INDEX IF NOT EXISTS "tires_truck_position_active_key" ON "tires" ("truckId","currentPosition")
  WHERE "lifecycleStatus"='INSTALLED' AND "truckId" IS NOT NULL AND "currentPosition" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "tires_trailer_position_active_key" ON "tires" ("trailerNumber","currentPosition")
  WHERE "lifecycleStatus"='INSTALLED' AND "trailerNumber" IS NOT NULL AND "currentPosition" IS NOT NULL;

ALTER TABLE "maintenance_records" ADD COLUMN IF NOT EXISTS "jobCardId" TEXT;
ALTER TABLE "trailer_maintenance_records" ADD COLUMN IF NOT EXISTS "jobCardId" TEXT;
CREATE INDEX IF NOT EXISTS "maintenance_records_jobCardId_idx" ON "maintenance_records" ("jobCardId");
CREATE INDEX IF NOT EXISTS "trailer_maintenance_records_jobCardId_idx" ON "trailer_maintenance_records" ("jobCardId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_records_jobCardId_fkey') THEN
    ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_jobCardId_fkey"
      FOREIGN KEY ("jobCardId") REFERENCES "workshop_job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trailer_maintenance_records_jobCardId_fkey') THEN
    ALTER TABLE "trailer_maintenance_records" ADD CONSTRAINT "trailer_maintenance_records_jobCardId_fkey"
      FOREIGN KEY ("jobCardId") REFERENCES "workshop_job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tire_lifecycle_events" (
  "id" TEXT PRIMARY KEY,
  "tireId" TEXT NOT NULL REFERENCES "tires"("id") ON DELETE RESTRICT,
  "eventType" TEXT NOT NULL,
  "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fromTruckId" TEXT,
  "fromTrailerId" TEXT,
  "toTruckId" TEXT,
  "toTrailerId" TEXT,
  "fromPosition" TEXT,
  "toPosition" TEXT,
  "driverNameSnapshot" TEXT,
  "odometerKm" INTEGER,
  "reason" TEXT,
  "damageType" TEXT,
  "repairable" BOOLEAN,
  "cost" DOUBLE PRECISION,
  "notes" TEXT,
  "jobCardId" TEXT REFERENCES "workshop_job_cards"("id") ON DELETE SET NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tire_lifecycle_events_tireId_eventAt_idx" ON "tire_lifecycle_events" ("tireId", "eventAt" DESC);
CREATE INDEX IF NOT EXISTS "tire_lifecycle_events_jobCardId_idx" ON "tire_lifecycle_events" ("jobCardId");
INSERT INTO "tire_lifecycle_events" ("id","tireId","eventType","eventAt","reason","notes","createdById")
SELECT 'tireevt_receipt_' || t."id", t."id", 'RECEIVE', t."createdAt",
  'Initial receipt; legacy purchase details were not available', t."notes", t."createdById"
FROM "tires" t
WHERE NOT EXISTS (
  SELECT 1 FROM "tire_lifecycle_events" e
  WHERE e."tireId"=t."id" AND e."eventType"='RECEIVE'
);

CREATE TABLE IF NOT EXISTS "tire_usage_periods" (
  "id" TEXT PRIMARY KEY,
  "tireId" TEXT NOT NULL REFERENCES "tires"("id") ON DELETE RESTRICT,
  "vehicleType" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "installedAt" TIMESTAMP(3) NOT NULL,
  "removedAt" TIMESTAMP(3),
  "startOdometer" INTEGER,
  "endOdometer" INTEGER,
  "driverNameSnapshot" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "tire_usage_periods_tireId_installedAt_idx" ON "tire_usage_periods" ("tireId", "installedAt");
CREATE INDEX IF NOT EXISTS "tire_usage_periods_vehicleType_vehicleId_idx" ON "tire_usage_periods" ("vehicleType", "vehicleId");
