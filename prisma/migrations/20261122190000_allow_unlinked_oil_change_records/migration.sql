-- Allow historical oil-change records to be stored without a registered truck.
ALTER TABLE "maintenance_records" ALTER COLUMN "truckId" DROP NOT NULL;
ALTER TABLE "maintenance_records" ADD COLUMN "vehiclePlateNumber" TEXT;
ALTER TABLE "maintenance_records" DROP CONSTRAINT IF EXISTS "maintenance_records_truckId_fkey";
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_truckId_fkey"
  FOREIGN KEY ("truckId") REFERENCES "trucks"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "maintenance_records_vehiclePlateNumber_idx"
  ON "maintenance_records" ("vehiclePlateNumber");
ALTER TABLE "maintenance_records" ADD COLUMN IF NOT EXISTS "sourceData" JSONB;
ALTER TABLE "maintenance_records" ADD COLUMN IF NOT EXISTS "sourceImportKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_records_sourceImportKey_key" ON "maintenance_records" ("sourceImportKey");
