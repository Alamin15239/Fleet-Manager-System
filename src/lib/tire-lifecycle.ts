import { randomUUID } from 'crypto'

type VehicleRef = { vehicleType: 'truck' | 'trailer'; vehicleId: string }

export async function ensureTireLifecycleTables(tx: any) {
  await ensureMaintenanceJobCardColumns(tx)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "truckId" TEXT`)
  await tx.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tires_truckId_fkey' AND conrelid='"tires"'::regclass) THEN
      ALTER TABLE "tires" ADD CONSTRAINT "tires_truckId_fkey"
        FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "internalCode" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'STOCK'`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "currentPosition" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMP(3)`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "installationOdometer" INTEGER`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "supplierName" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "purchaseReference" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "purchaseCost" DOUBLE PRECISION`)
  await tx.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "tire_internal_code_seq"`)
  await tx.$executeRawUnsafe(`UPDATE "tires" SET "internalCode"='TY-' || LPAD(nextval('"tire_internal_code_seq"')::text,6,'0') WHERE "internalCode" IS NULL`)
  await tx.$executeRawUnsafe(`UPDATE "tires" SET "lifecycleStatus"='INSTALLED', "installedAt"=COALESCE("installedAt","createdAt") WHERE "lifecycleStatus"='STOCK' AND ("truckId" IS NOT NULL OR NULLIF("trailerNumber",'') IS NOT NULL)`)
  await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "tires_internalCode_key" ON "tires" ("internalCode")`)
  await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "tires_truck_position_active_key" ON "tires" ("truckId","currentPosition") WHERE "lifecycleStatus"='INSTALLED' AND "truckId" IS NOT NULL AND "currentPosition" IS NOT NULL`)
  await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "tires_trailer_position_active_key" ON "tires" ("trailerNumber","currentPosition") WHERE "lifecycleStatus"='INSTALLED' AND "trailerNumber" IS NOT NULL AND "currentPosition" IS NOT NULL`)
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "tire_lifecycle_events" (
    "id" TEXT PRIMARY KEY,
    "tireId" TEXT NOT NULL REFERENCES "tires"("id") ON DELETE CASCADE ON UPDATE CASCADE,
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
    "treadDepthMm" DOUBLE PRECISION,
    "pressurePsi" DOUBLE PRECISION,
    "condition" TEXT,
    "inspectionDueAt" TIMESTAMP(3),
    "damageLocation" TEXT,
    "evidenceUrl" TEXT,
    "supplierName" TEXT,
    "purchaseReference" TEXT,
    "purchaseCost" DOUBLE PRECISION,
    "notes" TEXT,
    "jobCardId" TEXT REFERENCES "workshop_job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  await tx.$executeRawUnsafe(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tire_lifecycle_events_tireId_fkey' AND conrelid='"tire_lifecycle_events"'::regclass AND confdeltype <> 'c') THEN
      ALTER TABLE "tire_lifecycle_events" DROP CONSTRAINT "tire_lifecycle_events_tireId_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tire_lifecycle_events_tireId_fkey' AND conrelid='"tire_lifecycle_events"'::regclass) THEN
      ALTER TABLE "tire_lifecycle_events" ADD CONSTRAINT "tire_lifecycle_events_tireId_fkey"
        FOREIGN KEY ("tireId") REFERENCES "tires"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "treadDepthMm" DOUBLE PRECISION`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "pressurePsi" DOUBLE PRECISION`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "condition" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "inspectionDueAt" TIMESTAMP(3)`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "damageLocation" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "evidenceUrl" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "supplierName" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "purchaseReference" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_lifecycle_events" ADD COLUMN IF NOT EXISTS "purchaseCost" DOUBLE PRECISION`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_lifecycle_events_inspectionDueAt_idx" ON "tire_lifecycle_events" ("inspectionDueAt") WHERE "eventType"='INSPECT'`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tires_supplierName_idx" ON "tires" ("supplierName")`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_lifecycle_events_tireId_eventAt_idx" ON "tire_lifecycle_events" ("tireId","eventAt" DESC)`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_lifecycle_events_jobCardId_idx" ON "tire_lifecycle_events" ("jobCardId")`)
  await tx.$executeRawUnsafe(`INSERT INTO "tire_lifecycle_events" ("id","tireId","eventType","eventAt","toTruckId","toTrailerId","driverNameSnapshot","reason","createdById")
    SELECT 'tireevt_install_legacy_' || t."id", t."id", 'INSTALL', COALESCE(t."installedAt",t."createdAt"),
      t."truckId", CASE WHEN t."truckId" IS NULL THEN tr."id" ELSE NULL END, t."driverName", 'Initial installation; legacy wheel position and odometer were not available', t."createdById"
    FROM "tires" t LEFT JOIN "trailers" tr ON tr."number"=t."trailerNumber"
    WHERE t."lifecycleStatus"='INSTALLED'
      AND NOT EXISTS (SELECT 1 FROM "tire_lifecycle_events" e
        WHERE e."tireId"=t."id" AND e."eventType" IN ('INSTALL','TRANSFER'))`)
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "tire_usage_periods" (
    "id" TEXT PRIMARY KEY,
    "tireId" TEXT NOT NULL REFERENCES "tires"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "vehicleType" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),
    "historicalEndUnknown" BOOLEAN NOT NULL DEFAULT FALSE,
    "startOdometer" INTEGER,
    "endOdometer" INTEGER,
    "driverNameSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  await tx.$executeRawUnsafe(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tire_usage_periods_tireId_fkey' AND conrelid='"tire_usage_periods"'::regclass AND confdeltype <> 'c') THEN
      ALTER TABLE "tire_usage_periods" DROP CONSTRAINT "tire_usage_periods_tireId_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='tire_usage_periods_tireId_fkey' AND conrelid='"tire_usage_periods"'::regclass) THEN
      ALTER TABLE "tire_usage_periods" ADD CONSTRAINT "tire_usage_periods_tireId_fkey"
        FOREIGN KEY ("tireId") REFERENCES "tires"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_usage_periods_tireId_installedAt_idx" ON "tire_usage_periods" ("tireId","installedAt")`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_usage_periods_vehicleType_vehicleId_idx" ON "tire_usage_periods" ("vehicleType","vehicleId")`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tire_usage_periods" ADD COLUMN IF NOT EXISTS "historicalEndUnknown" BOOLEAN NOT NULL DEFAULT FALSE`)
  await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "tire_usage_periods_one_active_per_tire_key"`)
  await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "tire_usage_periods_one_active_per_tire_known_end_key" ON "tire_usage_periods" ("tireId") WHERE "removedAt" IS NULL AND "historicalEndUnknown"=FALSE`)
  await tx.$executeRawUnsafe(`INSERT INTO "tire_usage_periods" ("id","tireId","vehicleType","vehicleId","installedAt","driverNameSnapshot")
    SELECT 'tyuse_legacy_truck_' || t."id", t."id", 'truck', t."truckId",
      COALESCE(t."installedAt",t."createdAt"), t."driverName"
    FROM "tires" t
    WHERE t."lifecycleStatus"='INSTALLED' AND t."truckId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "tire_usage_periods" p WHERE p."tireId"=t."id" AND p."removedAt" IS NULL AND p."historicalEndUnknown"=FALSE)`)
  await tx.$executeRawUnsafe(`INSERT INTO "tire_usage_periods" ("id","tireId","vehicleType","vehicleId","installedAt","driverNameSnapshot")
    SELECT 'tyuse_legacy_trailer_' || t."id", t."id", 'trailer', tr."id",
      COALESCE(t."installedAt",t."createdAt"), t."driverName"
    FROM "tires" t JOIN "trailers" tr ON tr."number"=t."trailerNumber"
    WHERE t."lifecycleStatus"='INSTALLED' AND t."truckId" IS NULL AND NULLIF(t."trailerNumber",'') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "tire_usage_periods" p WHERE p."tireId"=t."id" AND p."removedAt" IS NULL AND p."historicalEndUnknown"=FALSE)`)
}

export async function getOrCreateOpenJobCard(tx: any, vehicle: VehicleRef, details: {
  eventAt: Date; odometerKm?: number | null; driverName?: string | null; userId: string;
  serviceType?: string; reportedIssue?: string; creationSource?: "TIRE" | "SPARE_PARTS" | "OIL" | "MANUAL" | "UNKNOWN";
  allowInactive?: boolean
}) {
  await ensureMaintenanceJobCardColumns(tx)
  const activeVehicle = vehicle.vehicleType === 'truck'
    ? await tx.truck.findFirst({ where: details.allowInactive ? { id: vehicle.vehicleId } : { id: vehicle.vehicleId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
    : await tx.trailer.findFirst({ where: details.allowInactive ? { id: vehicle.vehicleId } : { id: vehicle.vehicleId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
  if (!activeVehicle) throw new Error('Selected vehicle was not found or inactive')
  // Serialize card creation to prevent concurrent writes from opening duplicate cards.
  await tx.$executeRawUnsafe(`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`)
  const vehicleWhere = vehicle.vehicleType === 'truck' ? { truckId: vehicle.vehicleId } : { trailerId: vehicle.vehicleId }
  const existing = await tx.workshopJobCard.findFirst({
    where: { ...vehicleWhere, status: { in: ['OPEN', 'IN_PROGRESS'] }, creationSource: { not: 'WORKBOOK' } },
    orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
    select: { id: true }
  })
  if (existing) return existing.id

  const year = details.eventAt.getFullYear()
  const prefix = `JC-${year}-`
  const numbers = await tx.workshopJobCard.findMany({
    where: { jobNumber: { startsWith: prefix } }, select: { jobNumber: true }
  })
  const highest = numbers.reduce((max: number, item: { jobNumber: string }) => {
    const match = item.jobNumber.match(/^JC-\d{4}-(\d+)$/)
    return match ? Math.max(max, Number(match[1]) || 0) : max
  }, 0)
  const id = `jc_${randomUUID()}`
  await tx.workshopJobCard.create({
    data: {
      id, jobNumber: `${prefix}${String(highest + 1).padStart(4, '0')}`,
      ...(vehicle.vehicleType === 'truck' ? { truckId: vehicle.vehicleId } : { trailerId: vehicle.vehicleId }),
      serviceDate: details.eventAt, odometerKm: details.odometerKm ?? undefined,
      serviceType: details.serviceType || 'TIRE MAINTENANCE', creationSource: details.creationSource || 'UNKNOWN', priority: 'NORMAL',
      driverName: details.driverName || undefined, status: 'OPEN',
      reportedIssue: details.reportedIssue || 'Automatically created from maintenance activity',
      createdById: details.userId, items: [], checklist: {}
    }
  })
  return id
}

export async function recordTireLifecycleEvent(tx: any, input: {
  tireId: string; eventType: string; eventAt: Date; vehicle?: VehicleRef | null;
  position?: string | null; driverName?: string | null; odometerKm?: number | null;
  reason?: string | null; damageType?: string | null; repairable?: boolean | null;
  cost?: number | null; treadDepthMm?: number | null; pressurePsi?: number | null;
  condition?: string | null; inspectionDueAt?: Date | null; damageLocation?: string | null;
  evidenceUrl?: string | null; supplierName?: string | null; purchaseReference?: string | null;
  purchaseCost?: number | null; notes?: string | null; userId: string; ensureTables?: boolean
}) {
  if (input.ensureTables !== false) await ensureTireLifecycleTables(tx)
  const tireRows = await tx.$queryRawUnsafe(
    `SELECT "id","truckId","plateNumber","trailerNumber","lifecycleStatus","currentPosition","internalCode","installedAt"
     FROM "tires" WHERE "id"=$1 FOR UPDATE`, input.tireId
  )
  const tire = tireRows[0]
  if (!tire) throw new Error('Tire not found')
  const eventType = input.eventType.toUpperCase()
  const allowed = ['RECEIVE','INSTALL','REMOVE','TRANSFER','POSITION_CHANGE','DAMAGE','REPAIR','INSPECT','DISPOSE','ISSUE']
  if (!allowed.includes(eventType)) throw new Error('Unsupported tire event type')

  const currentTruckId = tire.truckId || null
  const target = input.vehicle || null
  if (['INSTALL','TRANSFER','POSITION_CHANGE','ISSUE'].includes(eventType) && !target) throw new Error('Select a destination vehicle')
  if (['INSTALL','TRANSFER','POSITION_CHANGE'].includes(eventType) && !input.position?.trim()) throw new Error('Select a wheel position before installation')
  if (eventType === 'RECEIVE') {
    const priorReceipt = await tx.$queryRawUnsafe(`SELECT 1 FROM "tire_lifecycle_events" WHERE "tireId"=$1 AND "eventType"='RECEIVE' LIMIT 1`, input.tireId)
    if (priorReceipt.length) throw new Error('This tire has already been received')
  }
  if (eventType === 'INSTALL' && tire.lifecycleStatus !== 'STOCK') throw new Error('Only a tire in stock can be installed')
  if (eventType === 'ISSUE' && !['STOCK','INSTALLED'].includes(tire.lifecycleStatus)) throw new Error('Only a stock or installed tire can be issued to a vehicle')
  if (eventType === 'DAMAGE' && tire.lifecycleStatus === 'DISPOSED') throw new Error('A disposed tire cannot receive a damage report')
  if (eventType === 'INSPECT' && tire.lifecycleStatus === 'DISPOSED') throw new Error('A disposed tire cannot be inspected')
  if (eventType === 'TRANSFER' && tire.lifecycleStatus !== 'INSTALLED') throw new Error('Only an installed tire can be transferred')
  if (eventType === 'POSITION_CHANGE' && tire.lifecycleStatus !== 'INSTALLED') throw new Error('Only an installed tire can change wheel position')
  if (eventType === 'REMOVE' && tire.lifecycleStatus !== 'INSTALLED' &&
      !(tire.lifecycleStatus === 'DAMAGED' && (currentTruckId || tire.trailerNumber)))
    throw new Error('Only an installed or vehicle-assigned damaged tire can be removed')
  if (eventType === 'DISPOSE' && (tire.lifecycleStatus === 'INSTALLED' || currentTruckId || tire.trailerNumber)) throw new Error('Remove the tire before disposal')
  if (eventType === 'REPAIR' && tire.lifecycleStatus !== 'DAMAGED') throw new Error('Only a damaged tire can be marked repaired')
  if (eventType === 'REPAIR' && (currentTruckId || tire.trailerNumber)) throw new Error('Remove the damaged tire before repair')
  if (eventType === 'RECEIVE' && (tire.lifecycleStatus === 'INSTALLED' || currentTruckId || tire.trailerNumber)) throw new Error('An installed tire cannot be received again')

  let jobCardId: string | null = null
  const currentTrailer = tire.trailerNumber ? await tx.trailer.findFirst({ where: { number: tire.trailerNumber }, select: { id: true, driverName: true } }) : null
  const currentTruck = currentTruckId ? await tx.truck.findUnique({ where: { id: currentTruckId }, select: { driverName: true } }) : null
  const targetVehicleDriver = target?.vehicleType === 'truck'
    ? (await tx.truck.findUnique({ where: { id: target.vehicleId }, select: { driverName: true } }))?.driverName
    : target?.vehicleType === 'trailer'
      ? (await tx.trailer.findUnique({ where: { id: target.vehicleId }, select: { driverName: true } }))?.driverName
      : null
  const currentVehicle: VehicleRef | null = currentTruckId
    ? { vehicleType: 'truck', vehicleId: currentTruckId }
    : currentTrailer ? { vehicleType: 'trailer', vehicleId: currentTrailer.id } : null
  // Never save a vehicle-mounted operation without a canonical fleet link:
  // otherwise the tire event would be orphaned from its required Job Card.
  const vehicleLinkedOperations = ['TRANSFER','POSITION_CHANGE','REMOVE','DAMAGE','INSPECT','DISPOSE']
  if (tire.lifecycleStatus === 'INSTALLED' && !currentVehicle && vehicleLinkedOperations.includes(eventType)) {
    throw new Error('This installed tire is not linked to an active truck or trailer. Correct its vehicle assignment before recording this operation.')
  }
  if (tire.lifecycleStatus === 'DAMAGED' && (tire.plateNumber || tire.trailerNumber) && !currentVehicle &&
      ['REMOVE','REPAIR','DISPOSE'].includes(eventType)) {
    throw new Error('This damaged tire has an unresolved vehicle assignment. Correct its vehicle assignment before continuing.')
  }
  if (eventType === 'TRANSFER' && currentVehicle && target &&
      currentVehicle.vehicleType === target.vehicleType && currentVehicle.vehicleId === target.vehicleId)
    throw new Error('Use Change wheel position when moving a tire within the same vehicle')
  if (eventType === 'POSITION_CHANGE' && (!currentVehicle || !target ||
      currentVehicle.vehicleType !== target.vehicleType || currentVehicle.vehicleId !== target.vehicleId))
    throw new Error('A wheel-position change must stay on the same vehicle')
  if (target && input.position) {
    if (target.vehicleType === 'truck' && currentTruckId === target.vehicleId && tire.currentPosition === input.position)
      throw new Error('Tire is already in this wheel position')
    if (target.vehicleType === 'trailer' && currentTrailer?.id === target.vehicleId && tire.currentPosition === input.position)
      throw new Error('Tire is already in this wheel position')
    const occupied = target.vehicleType === 'truck'
      ? await tx.$queryRawUnsafe(`SELECT "id" FROM "tires" WHERE "truckId"=$1 AND "currentPosition"=$2 AND "lifecycleStatus"='INSTALLED' AND "id"<>$3 LIMIT 1`, target.vehicleId, input.position, input.tireId)
      : await tx.$queryRawUnsafe(`SELECT "id" FROM "tires" WHERE "trailerNumber"=(SELECT "number" FROM "trailers" WHERE "id"=$1) AND "currentPosition"=$2 AND "lifecycleStatus"='INSTALLED' AND "id"<>$3 LIMIT 1`, target.vehicleId, input.position, input.tireId)
    if (occupied.length) throw new Error('Wheel position already occupied by another tire')
  }
  const sourceDriverName = currentTruck?.driverName || currentTrailer?.driverName || null
  const eventDriverName = input.driverName || (eventType === 'INSTALL' ? targetVehicleDriver : sourceDriverName) || targetVehicleDriver || null
  const usageDriverName = input.driverName || targetVehicleDriver || eventDriverName
  const operationalVehicle = ['TRANSFER','POSITION_CHANGE','REMOVE','DAMAGE','REPAIR','INSPECT','DISPOSE'].includes(eventType)
    ? currentVehicle || target : target || currentVehicle
  if (operationalVehicle && !['RECEIVE'].includes(eventType)) {
    jobCardId = await getOrCreateOpenJobCard(tx, operationalVehicle, {
      eventAt: input.eventAt, odometerKm: input.odometerKm, driverName: eventDriverName, userId: input.userId,
      serviceType: eventType === 'ISSUE' ? 'TIRE ISSUE' : 'TIRE MAINTENANCE', creationSource: 'TIRE', reportedIssue: eventType === 'ISSUE' ? 'Tire issued to vehicle from outgoing tire sheet; installation position not recorded' : 'Automatically created from tire lifecycle activity'
    })
  } else if (['REPAIR','DISPOSE','DAMAGE'].includes(eventType)) {
    const previousVehicleEvent = await tx.$queryRawUnsafe(
      `SELECT "jobCardId","fromTruckId","fromTrailerId" FROM "tire_lifecycle_events"
       WHERE "tireId"=$1 AND "jobCardId" IS NOT NULL
       ORDER BY "eventAt" DESC,"createdAt" DESC LIMIT 1`, input.tireId
    )
    const previous = previousVehicleEvent[0]
    if (previous?.jobCardId) {
      const openCard = await tx.workshopJobCard.findFirst({
        where: { id: previous.jobCardId, status: { in: ['OPEN','IN_PROGRESS'] }, creationSource: { not: 'WORKBOOK' } },
        select: { id: true }
      })
      if (openCard) jobCardId = openCard.id
    }
    if (!jobCardId && previous?.fromTruckId) {
      jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType: 'truck', vehicleId: previous.fromTruckId }, {
        eventAt: input.eventAt, odometerKm: input.odometerKm, driverName: eventDriverName, userId: input.userId,
        serviceType: 'TIRE MAINTENANCE', creationSource: 'TIRE', reportedIssue: 'Automatically created for tire repair or disposal'
      })
    } else if (!jobCardId && previous?.fromTrailerId) {
      jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType: 'trailer', vehicleId: previous.fromTrailerId }, {
        eventAt: input.eventAt, odometerKm: input.odometerKm, driverName: eventDriverName, userId: input.userId,
        serviceType: 'TIRE MAINTENANCE', reportedIssue: 'Automatically created for tire repair or disposal'
      })
    }
  }

  const fromTruckId = currentTruckId
  const fromPosition = tire.currentPosition || null
  const toTruckId = target?.vehicleType === 'truck' ? target.vehicleId : null
  const toTrailerId = target?.vehicleType === 'trailer' ? target.vehicleId : null
  const eventId = `tireevt_${randomUUID()}`
  await tx.$executeRawUnsafe(
    `INSERT INTO "tire_lifecycle_events"
     ("id","tireId","eventType","eventAt","fromTruckId","fromTrailerId","toTruckId","toTrailerId","fromPosition","toPosition","driverNameSnapshot","odometerKm","reason","damageType","repairable","cost","treadDepthMm","pressurePsi","condition","inspectionDueAt","damageLocation","evidenceUrl","supplierName","purchaseReference","purchaseCost","notes","jobCardId","createdById")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
    eventId, input.tireId, eventType, input.eventAt, fromTruckId, currentTrailer?.id || null, toTruckId, toTrailerId,
    fromPosition, input.position || null, eventDriverName, input.odometerKm ?? null,
    input.reason || null, input.damageType || null, input.repairable ?? null, input.cost ?? null,
    input.treadDepthMm ?? null, input.pressurePsi ?? null, input.condition || null, input.inspectionDueAt ?? null,
    input.damageLocation || null, input.evidenceUrl || null, input.supplierName || null,
    input.purchaseReference || null, input.purchaseCost ?? null, input.notes || null, jobCardId, input.userId
  )

  // Tire work performed on a vehicle is part of its job-card cost summary.
  // Stock receipt remains a purchasing/inventory event and is not charged to a vehicle visit.
  if (jobCardId && input.cost != null && Number.isFinite(Number(input.cost)) && Number(input.cost) > 0) {
    await tx.$executeRawUnsafe(
      `UPDATE "workshop_job_cards"
       SET "partsCost"=COALESCE("partsCost",0)+$2,
           "totalCost"=COALESCE("totalCost",0)+$2,
           "updatedAt"=NOW()
       WHERE "id"=$1`,
      jobCardId, Number(input.cost)
    )
  }

  // ISSUE can reassign an installed tire without confirming its wheel position;
  // close any prior mounted usage period before marking it assigned-unverified.
  if (eventType === 'TRANSFER' || eventType === 'REMOVE' || eventType === 'ISSUE') {
    await tx.$executeRawUnsafe(
      `UPDATE "tire_usage_periods" SET "removedAt"=$2,"endOdometer"=$3
       WHERE "tireId"=$1 AND "removedAt" IS NULL AND "historicalEndUnknown"=FALSE`,
      input.tireId, input.eventAt, input.odometerKm ?? null
    )
  }
  if ((eventType === 'INSTALL' || eventType === 'TRANSFER') && target) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "tire_usage_periods" ("id","tireId","vehicleType","vehicleId","installedAt","startOdometer","driverNameSnapshot")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      `tyuse_${randomUUID()}`, input.tireId, target.vehicleType, target.vehicleId,
      input.eventAt, input.odometerKm ?? null, usageDriverName
    )
  }
  const nextStatus = eventType === 'INSTALL' || eventType === 'TRANSFER' ? 'INSTALLED'
    : eventType === 'ISSUE' ? 'ASSIGNED_UNVERIFIED'
    : eventType === 'DAMAGE' ? 'DAMAGED'
    : eventType === 'DISPOSE' ? 'DISPOSED'
    : eventType === 'REMOVE' ? (tire.lifecycleStatus === 'DAMAGED' ? 'DAMAGED' : 'STOCK')
    : eventType === 'REPAIR' ? 'STOCK'
    : eventType === 'RECEIVE' ? 'STOCK' : String(tire.lifecycleStatus || 'STOCK')
  if (eventType === 'INSTALL' || eventType === 'TRANSFER' || eventType === 'ISSUE') {
    if (target?.vehicleType === 'truck') {
      const rows = await tx.$queryRawUnsafe(`SELECT "licensePlate","driverName" FROM "trucks" WHERE "id"=$1 AND "isDeleted"=false`, target.vehicleId)
      if (!rows.length) throw new Error('Selected truck was not found')
      if (eventType === 'ISSUE') {
        await tx.$executeRawUnsafe(
          `UPDATE "tires" SET "truckId"=$2,"plateNumber"=$3,"trailerNumber"=NULL,"currentPosition"=NULL,"driverName"=COALESCE($4,"driverName"),"lifecycleStatus"='ASSIGNED_UNVERIFIED',"updatedAt"=NOW() WHERE "id"=$1`,
          input.tireId, target.vehicleId, rows[0].licensePlate, input.driverName || null
        )
      } else {
        await tx.$executeRawUnsafe(
          `UPDATE "tires" SET "truckId"=$2,"plateNumber"=$3,"trailerNumber"=NULL,"currentPosition"=$4,"lifecycleStatus"='INSTALLED',
           "installedAt"=$5,"installationOdometer"=$6,"updatedAt"=NOW() WHERE "id"=$1`,
          input.tireId, target.vehicleId, rows[0].licensePlate, input.position || null, input.eventAt, input.odometerKm ?? null
        )
      }
    } else if (target?.vehicleType === 'trailer') {
      const rows = await tx.$queryRawUnsafe(`SELECT "number","driverName" FROM "trailers" WHERE "id"=$1 AND "isDeleted"=false`, target.vehicleId)
      if (!rows.length) throw new Error('Selected trailer was not found')
      if (eventType === 'ISSUE') {
        await tx.$executeRawUnsafe(
          `UPDATE "tires" SET "truckId"=NULL,"plateNumber"=NULL,"trailerNumber"=$2,"currentPosition"=NULL,"driverName"=COALESCE($3,"driverName"),"lifecycleStatus"='ASSIGNED_UNVERIFIED',"updatedAt"=NOW() WHERE "id"=$1`,
          input.tireId, rows[0].number, input.driverName || null
        )
      } else {
        await tx.$executeRawUnsafe(
          `UPDATE "tires" SET "truckId"=NULL,"plateNumber"=NULL,"trailerNumber"=$2,"currentPosition"=$3,"lifecycleStatus"='INSTALLED',
           "installedAt"=$4,"installationOdometer"=$5,"updatedAt"=NOW() WHERE "id"=$1`,
          input.tireId, rows[0].number, input.position || null, input.eventAt, input.odometerKm ?? null
        )
      }
    }
  } else if (eventType === 'POSITION_CHANGE') {
    await tx.$executeRawUnsafe(
      `UPDATE "tires" SET "currentPosition"=$2,"updatedAt"=NOW() WHERE "id"=$1`,
      input.tireId, input.position || null
    )
  } else {
    await tx.$executeRawUnsafe(
      `UPDATE "tires" SET "truckId"=CASE WHEN $2 THEN NULL ELSE "truckId" END,
       "plateNumber"=CASE WHEN $2 THEN NULL ELSE "plateNumber" END,
       "trailerNumber"=CASE WHEN $2 THEN NULL ELSE "trailerNumber" END,
       "currentPosition"=CASE WHEN $2 THEN NULL ELSE "currentPosition" END,
       "lifecycleStatus"=$3,"updatedAt"=NOW() WHERE "id"=$1`,
      input.tireId, eventType === 'REMOVE' || eventType === 'DISPOSE', nextStatus
    )
  }
  return { eventId, jobCardId, lifecycleStatus: nextStatus }
}


export async function ensureMaintenanceJobCardColumns(tx: any) {
  // Bootstrap the central maintenance entity before any module attempts to
  // attach work to it. Keep this idempotent for existing production databases.
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "workshop_job_cards" (
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
    "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
    CONSTRAINT "workshop_job_cards_jobNumber_key" UNIQUE ("jobNumber"),
    CONSTRAINT "workshop_job_cards_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workshop_job_cards_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workshop_job_cards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workshop_job_cards_vehicle_check" CHECK (num_nonnulls("truckId", "trailerId") = 1)
  )`)
  await tx.$executeRawUnsafe(`ALTER TABLE "workshop_job_cards" ADD COLUMN IF NOT EXISTS "creationSource" TEXT NOT NULL DEFAULT 'UNKNOWN'`)
  await tx.$executeRawUnsafe(`DO $ DECLARE constraint_definition TEXT; BEGIN
    SELECT pg_get_constraintdef(oid) INTO constraint_definition
    FROM pg_constraint
    WHERE conname='workshop_job_cards_vehicle_check'
      AND conrelid='"workshop_job_cards"'::regclass;
    IF constraint_definition IS NULL OR position('<= 1' IN constraint_definition)=0 THEN
      ALTER TABLE "workshop_job_cards" DROP CONSTRAINT IF EXISTS "workshop_job_cards_vehicle_check";
      ALTER TABLE "workshop_job_cards" ADD CONSTRAINT "workshop_job_cards_vehicle_check"
        CHECK (num_nonnulls("truckId", "trailerId") <= 1);
    END IF;
  END $`)
  await tx.$executeRawUnsafe(`ALTER TABLE "workshop_job_cards" ADD COLUMN IF NOT EXISTS "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await tx.$executeRawUnsafe(`ALTER TABLE "workshop_job_cards" ADD COLUMN IF NOT EXISTS "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await tx.$executeRawUnsafe(`ALTER TABLE "workshop_job_cards" ADD COLUMN IF NOT EXISTS "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0`)
  await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "workshop_job_cards_jobNumber_key" ON "workshop_job_cards" ("jobNumber")`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "workshop_job_cards_serviceDate_idx" ON "workshop_job_cards" ("serviceDate")`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "workshop_job_cards_truckId_idx" ON "workshop_job_cards" ("truckId")`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "workshop_job_cards_trailerId_idx" ON "workshop_job_cards" ("trailerId")`)
  await tx.$executeRawUnsafe(`ALTER TABLE "maintenance_records" ADD COLUMN IF NOT EXISTS "jobCardId" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "trailer_maintenance_records" ADD COLUMN IF NOT EXISTS "jobCardId" TEXT`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "maintenance_records_jobCardId_idx" ON "maintenance_records" ("jobCardId")`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "trailer_maintenance_records_jobCardId_idx" ON "trailer_maintenance_records" ("jobCardId")`)
  await tx.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='maintenance_records_jobCardId_fkey' AND conrelid='"maintenance_records"'::regclass) THEN
      ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_jobCardId_fkey"
        FOREIGN KEY ("jobCardId") REFERENCES "workshop_job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='trailer_maintenance_records_jobCardId_fkey' AND conrelid='"trailer_maintenance_records"'::regclass) THEN
      ALTER TABLE "trailer_maintenance_records" ADD CONSTRAINT "trailer_maintenance_records_jobCardId_fkey"
        FOREIGN KEY ("jobCardId") REFERENCES "workshop_job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$`)
}
