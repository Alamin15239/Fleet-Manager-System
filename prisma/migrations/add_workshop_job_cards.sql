CREATE TABLE "workshop_job_cards" (
  "id" TEXT NOT NULL,
  "jobNumber" TEXT NOT NULL,
  "truckId" TEXT,
  "trailerId" TEXT,
  "serviceDate" TIMESTAMP(3) NOT NULL,
  "odometerKm" INTEGER,
  "serviceType" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "reportedIssue" TEXT,
  "technicianName" TEXT,
  "driverName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "nextServiceOdometer" INTEGER,
  "nextServiceDate" TIMESTAMP(3),
  "notes" TEXT,
  "items" JSONB NOT NULL DEFAULT '[]',
  "checklist" JSONB NOT NULL DEFAULT '{}',
  "technicianSignature" TEXT,
  "supervisorSignature" TEXT,
  "driverSignature" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workshop_job_cards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_job_cards_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workshop_job_cards_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workshop_job_cards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "workshop_job_cards_vehicle_check" CHECK (num_nonnulls("truckId", "trailerId") = 1)
);

CREATE UNIQUE INDEX "workshop_job_cards_jobNumber_key" ON "workshop_job_cards"("jobNumber");
CREATE INDEX "workshop_job_cards_serviceDate_idx" ON "workshop_job_cards"("serviceDate");
CREATE INDEX "workshop_job_cards_truckId_idx" ON "workshop_job_cards"("truckId");
CREATE INDEX "workshop_job_cards_trailerId_idx" ON "workshop_job_cards"("trailerId");
