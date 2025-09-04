-- Add historical data fields to maintenance records to preserve names at time of creation

-- Add historical fields to MaintenanceRecord
ALTER TABLE "maintenance_records" ADD COLUMN "vehicleName" TEXT;
ALTER TABLE "maintenance_records" ADD COLUMN "mechanicName" TEXT;
ALTER TABLE "maintenance_records" ADD COLUMN "driverName" TEXT;

-- Add historical fields to TrailerMaintenanceRecord  
ALTER TABLE "trailer_maintenance_records" ADD COLUMN "vehicleName" TEXT;
ALTER TABLE "trailer_maintenance_records" ADD COLUMN "mechanicName" TEXT;
ALTER TABLE "trailer_maintenance_records" ADD COLUMN "driverName" TEXT;