-- Add serialNumber field to tires table
ALTER TABLE "tires" ADD COLUMN "serialNumber" TEXT;

-- Add index for serialNumber for better search performance
CREATE INDEX "tires_serialNumber_idx" ON "tires"("serialNumber");