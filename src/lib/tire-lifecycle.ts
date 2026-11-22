import { randomUUID } from 'crypto'

type VehicleRef = { vehicleType: 'truck' | 'trailer'; vehicleId: string }

export async function ensureTireLifecycleTables(tx: any) {
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "internalCode" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "lifecycleStatus" TEXT NOT NULL DEFAULT 'STOCK'`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "currentPosition" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMP(3)`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "installationOdometer" INTEGER`)
  await tx.$executeRawUnsafe(`ALTER TABLE "tires" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`)
  await tx.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "tire_internal_code_seq"`)
  await tx.$executeRawUnsafe(`UPDATE "tires" SET "internalCode"='TY-' || LPAD(nextval('"tire_internal_code_seq"')::text,6,'0') WHERE "internalCode" IS NULL`)
  await tx.$executeRawUnsafe(`UPDATE "tires" SET "lifecycleStatus"='INSTALLED', "installedAt"=COALESCE("installedAt","createdAt") WHERE "lifecycleStatus"='STOCK' AND ("truckId" IS NOT NULL OR NULLIF("trailerNumber",'') IS NOT NULL)`)
  await tx.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "tires_internalCode_key" ON "tires" ("internalCode") WHERE "internalCode" IS NOT NULL`)
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "tire_lifecycle_events" (
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
  )`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_lifecycle_events_tireId_eventAt_idx" ON "tire_lifecycle_events" ("tireId","eventAt" DESC)`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_lifecycle_events_jobCardId_idx" ON "tire_lifecycle_events" ("jobCardId")`)
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "tire_usage_periods" (
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
  )`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_usage_periods_tireId_installedAt_idx" ON "tire_usage_periods" ("tireId","installedAt")`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tire_usage_periods_vehicleType_vehicleId_idx" ON "tire_usage_periods" ("vehicleType","vehicleId")`)
}

export async function getOrCreateOpenJobCard(tx: any, vehicle: VehicleRef, details: {
  eventAt: Date; odometerKm?: number | null; driverName?: string | null; userId: string;
  serviceType?: string; reportedIssue?: string
}) {
  // Serialize card creation to prevent two simultaneous tire operations opening duplicate cards.
  await tx.$executeRawUnsafe(`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`)
  const vehicleWhere = vehicle.vehicleType === 'truck' ? { truckId: vehicle.vehicleId } : { trailerId: vehicle.vehicleId }
  const existing = await tx.workshopJobCard.findFirst({
    where: { ...vehicleWhere, status: { in: ['OPEN', 'IN_PROGRESS'] } },
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
      serviceType: details.serviceType || 'TIRE MAINTENANCE', priority: 'NORMAL',
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
  cost?: number | null; notes?: string | null; userId: string
}) {
  await ensureTireLifecycleTables(tx)
  const tireRows = await tx.$queryRawUnsafe(
    `SELECT "id","truckId","plateNumber","trailerNumber","lifecycleStatus","currentPosition","internalCode","installedAt"
     FROM "tires" WHERE "id"=$1 FOR UPDATE`, input.tireId
  )
  const tire = tireRows[0]
  if (!tire) throw new Error('Tire not found')
  const eventType = input.eventType.toUpperCase()
  const allowed = ['RECEIVE','INSTALL','REMOVE','TRANSFER','DAMAGE','REPAIR','INSPECT','DISPOSE']
  if (!allowed.includes(eventType)) throw new Error('Unsupported tire event type')

  const currentTruckId = tire.truckId || null
  const target = input.vehicle || null
  if (['INSTALL','TRANSFER'].includes(eventType) && !target) throw new Error('Select a destination vehicle')
  if (eventType === 'INSTALL' && tire.lifecycleStatus !== 'STOCK') throw new Error('Only a tire in stock can be installed')
  if (eventType === 'TRANSFER' && tire.lifecycleStatus !== 'INSTALLED') throw new Error('Only an installed tire can be transferred')
  if (eventType === 'REMOVE' && tire.lifecycleStatus !== 'INSTALLED') throw new Error('Only an installed tire can be removed')
  if (eventType === 'DISPOSE' && (tire.lifecycleStatus === 'INSTALLED' || currentTruckId || tire.trailerNumber)) throw new Error('Remove the tire before disposal')
  if (eventType === 'REPAIR' && tire.lifecycleStatus !== 'DAMAGED') throw new Error('Only a damaged tire can be marked repaired')
  if (eventType === 'REPAIR' && (currentTruckId || tire.trailerNumber)) throw new Error('Remove the damaged tire before repair')
  if (eventType === 'RECEIVE' && (tire.lifecycleStatus === 'INSTALLED' || currentTruckId || tire.trailerNumber)) throw new Error('An installed tire cannot be received again')

  let jobCardId: string | null = null
  const currentTrailer = tire.trailerNumber ? await tx.trailer.findFirst({ where: { number: tire.trailerNumber }, select: { id: true } }) : null
  const currentVehicle: VehicleRef | null = currentTruckId
    ? { vehicleType: 'truck', vehicleId: currentTruckId }
    : currentTrailer ? { vehicleType: 'trailer', vehicleId: currentTrailer.id } : null
  const operationalVehicle = ['TRANSFER','REMOVE','DAMAGE','REPAIR','DISPOSE'].includes(eventType)
    ? currentVehicle || target : target || currentVehicle
  if (operationalVehicle && !['RECEIVE'].includes(eventType)) {
    jobCardId = await getOrCreateOpenJobCard(tx, operationalVehicle, {
      eventAt: input.eventAt, odometerKm: input.odometerKm, driverName: input.driverName, userId: input.userId,
      serviceType: 'TIRE MAINTENANCE', reportedIssue: 'Automatically created from tire lifecycle activity'
    })
  }

  const fromTruckId = currentTruckId
  const fromPosition = tire.currentPosition || null
  const toTruckId = target?.vehicleType === 'truck' ? target.vehicleId : null
  const toTrailerId = target?.vehicleType === 'trailer' ? target.vehicleId : null
  const eventId = `tireevt_${randomUUID()}`
  await tx.$executeRawUnsafe(
    `INSERT INTO "tire_lifecycle_events"
     ("id","tireId","eventType","eventAt","fromTruckId","fromTrailerId","toTruckId","toTrailerId","fromPosition","toPosition","driverNameSnapshot","odometerKm","reason","damageType","repairable","cost","notes","jobCardId","createdById")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    eventId, input.tireId, eventType, input.eventAt, fromTruckId, currentTrailer?.id || null, toTruckId, toTrailerId,
    fromPosition, input.position || null, input.driverName || null, input.odometerKm ?? null,
    input.reason || null, input.damageType || null, input.repairable ?? null, input.cost ?? null,
    input.notes || null, jobCardId, input.userId
  )

  if (eventType === 'TRANSFER' || eventType === 'REMOVE') {
    await tx.$executeRawUnsafe(
      `UPDATE "tire_usage_periods" SET "removedAt"=$2,"endOdometer"=$3
       WHERE "tireId"=$1 AND "removedAt" IS NULL`,
      input.tireId, input.eventAt, input.odometerKm ?? null
    )
  }
  if ((eventType === 'INSTALL' || eventType === 'TRANSFER') && target) {
    await tx.$executeRawUnsafe(
      `INSERT INTO "tire_usage_periods" ("id","tireId","vehicleType","vehicleId","installedAt","startOdometer","driverNameSnapshot")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      `tyuse_${randomUUID()}`, input.tireId, target.vehicleType, target.vehicleId,
      input.eventAt, input.odometerKm ?? null, input.driverName || null
    )
  }
  const nextStatus = eventType === 'INSTALL' || eventType === 'TRANSFER' ? 'INSTALLED'
    : eventType === 'DAMAGE' ? 'DAMAGED'
    : eventType === 'DISPOSE' ? 'DISPOSED'
    : eventType === 'REMOVE' ? (tire.lifecycleStatus === 'DAMAGED' ? 'DAMAGED' : 'STOCK')
    : eventType === 'REPAIR' ? 'STOCK'
    : eventType === 'RECEIVE' ? 'STOCK' : String(tire.lifecycleStatus || 'STOCK')
  if (eventType === 'INSTALL' || eventType === 'TRANSFER') {
    if (target?.vehicleType === 'truck') {
      const rows = await tx.$queryRawUnsafe(`SELECT "licensePlate","driverName" FROM "trucks" WHERE "id"=$1 AND "isDeleted"=false`, target.vehicleId)
      if (!rows.length) throw new Error('Selected truck was not found')
      await tx.$executeRawUnsafe(
        `UPDATE "tires" SET "truckId"=$2,"plateNumber"=$3,"trailerNumber"=NULL,"currentPosition"=$4,"lifecycleStatus"='INSTALLED',
         "installedAt"=$5,"installationOdometer"=$6,"updatedAt"=NOW() WHERE "id"=$1`,
        input.tireId, target.vehicleId, rows[0].licensePlate, input.position || null, input.eventAt, input.odometerKm ?? null
      )
    } else if (target?.vehicleType === 'trailer') {
      const rows = await tx.$queryRawUnsafe(`SELECT "number","driverName" FROM "trailers" WHERE "id"=$1 AND "isDeleted"=false`, target.vehicleId)
      if (!rows.length) throw new Error('Selected trailer was not found')
      await tx.$executeRawUnsafe(
        `UPDATE "tires" SET "truckId"=NULL,"plateNumber"=NULL,"trailerNumber"=$2,"currentPosition"=$3,"lifecycleStatus"='INSTALLED',
         "installedAt"=$4,"installationOdometer"=$5,"updatedAt"=NOW() WHERE "id"=$1`,
        input.tireId, rows[0].number, input.position || null, input.eventAt, input.odometerKm ?? null
      )
    }
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
  await tx.$executeRawUnsafe(`ALTER TABLE "maintenance_records" ADD COLUMN IF NOT EXISTS "jobCardId" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "trailer_maintenance_records" ADD COLUMN IF NOT EXISTS "jobCardId" TEXT`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "maintenance_records_jobCardId_idx" ON "maintenance_records" ("jobCardId")`)
  await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "trailer_maintenance_records_jobCardId_idx" ON "trailer_maintenance_records" ("jobCardId")`)
}
