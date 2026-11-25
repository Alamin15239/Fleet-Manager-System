import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { ensureMaintenanceJobCardColumns, ensureTireLifecycleTables, getOrCreateOpenJobCard } from '@/lib/tire-lifecycle'

type VehicleType = 'truck' | 'trailer'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'maintenance', 'update')
    const result = await db.$transaction(async tx => {
      await ensureTireLifecycleTables(tx)
      let linked = 0
      let skipped = 0

      const maintenance = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","truckId","datePerformed","currentMileage","driverName","serviceType","description","partsCost","laborCost","totalCost"
        FROM "maintenance_records"
        WHERE "jobCardId" IS NULL AND "isDeleted"=false AND "truckId" IS NOT NULL
        ORDER BY "datePerformed" ASC
      `)
      for (const row of maintenance) {
        try {
          const jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType: 'truck', vehicleId: row.truckId }, {
            eventAt: row.datePerformed, odometerKm: row.currentMileage, driverName: row.driverName,
            userId: user.id, serviceType: row.serviceType || 'MAINTENANCE', creationSource: /oil/i.test(String(row.serviceType || '')) ? 'OIL' : 'UNKNOWN',
            reportedIssue: row.description || 'Linked from existing maintenance record'
          })
          const attached = await tx.$queryRawUnsafe<any[]>('UPDATE "maintenance_records" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL RETURNING "id"', row.id, jobCardId)
          if (attached.length) {
            await tx.$executeRawUnsafe('UPDATE "workshop_job_cards" SET "partsCost"=COALESCE("partsCost",0)+$2,"laborCost"=COALESCE("laborCost",0)+$3,"totalCost"=COALESCE("totalCost",0)+$4,"updatedAt"=NOW() WHERE "id"=$1', jobCardId, row.partsCost || 0, row.laborCost || 0, row.totalCost || 0)
            linked++
          }
        } catch { skipped++ }
      }

      const trailerMaintenance = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","trailerId","datePerformed","driverName","serviceType","description","partsCost","laborCost","totalCost"
        FROM "trailer_maintenance_records"
        WHERE "jobCardId" IS NULL AND "isDeleted"=false AND "trailerId" IS NOT NULL
        ORDER BY "datePerformed" ASC
      `)
      for (const row of trailerMaintenance) {
        try {
          const jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType: 'trailer', vehicleId: row.trailerId }, {
            eventAt: row.datePerformed, driverName: row.driverName, userId: user.id,
            serviceType: row.serviceType || 'TRAILER MAINTENANCE',
            creationSource: /oil/i.test(String(row.serviceType || '')) ? 'OIL' : 'UNKNOWN',
            reportedIssue: row.description || 'Linked from existing trailer maintenance record'
          })
          const attached = await tx.$queryRawUnsafe<any[]>('UPDATE "trailer_maintenance_records" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL RETURNING "id"', row.id, jobCardId)
          if (attached.length) {
            await tx.$executeRawUnsafe('UPDATE "workshop_job_cards" SET "partsCost"=COALESCE("partsCost",0)+$2,"laborCost"=COALESCE("laborCost",0)+$3,"totalCost"=COALESCE("totalCost",0)+$4,"updatedAt"=NOW() WHERE "id"=$1', jobCardId, row.partsCost || 0, row.laborCost || 0, row.totalCost || 0)
            linked++
          }
        } catch { skipped++ }
      }

      const issues = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","vehicleType","vehicleId","transactionDate","notes","quantity","unitCost"
        FROM "inventory_transactions"
        WHERE "type"='ISSUE' AND "jobCardId" IS NULL
          AND "vehicleType" IN ('truck','trailer') AND "vehicleId" IS NOT NULL
        ORDER BY "transactionDate" ASC
      `)
      for (const row of issues) {
        try {
          const vehicleType = row.vehicleType as VehicleType
          const jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType, vehicleId: row.vehicleId }, {
            eventAt: row.transactionDate, userId: user.id, creationSource: 'SPARE_PARTS',
            serviceType: 'SPARE PARTS', reportedIssue: row.notes || 'Linked from existing spare-parts issue'
          })
          const attached = await tx.$queryRawUnsafe<any[]>('UPDATE "inventory_transactions" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL RETURNING "id"', row.id, jobCardId)
          if (attached.length) {
            const cost = Number(row.quantity || 0) * Number(row.unitCost || 0)
            await tx.$executeRawUnsafe('UPDATE "workshop_job_cards" SET "partsCost"=COALESCE("partsCost",0)+$2,"totalCost"=COALESCE("totalCost",0)+$2,"updatedAt"=NOW() WHERE "id"=$1', jobCardId, cost)
            linked++
          }
        } catch { skipped++ }
      }

      // Recover the 211 workbook usage rows that were previously saved only
      // in tire notes because the source vehicle could not be resolved.
      const unresolvedSourceTires = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","notes","serialNumber","driverName"
        FROM "tires"
        WHERE "notes" ILIKE '%Unlinked source rows%'
        ORDER BY "createdAt" ASC,"id" ASC
      `)
      const unassignedCardCache = new Map<string, string>()
      const getUnassignedCard = async (eventAt: Date, marker: string, sourceDetails: string, driverName: string | null) => {
        const cached = unassignedCardCache.get(marker)
        if (cached) return cached
        await tx.$executeRawUnsafe('LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE')
        const existing = await tx.workshopJobCard.findFirst({
          where: { truckId: null, trailerId: null, notes: { contains: marker } },
          select: { id: true }
        })
        if (existing) {
          unassignedCardCache.set(marker, existing.id)
          return existing.id
        }
        const year = eventAt.getFullYear()
        const prefix = `JC-${year}-`
        const numbers = await tx.workshopJobCard.findMany({ where: { jobNumber: { startsWith: prefix } }, select: { jobNumber: true } })
        const highest = numbers.reduce((max: number, item: { jobNumber: string }) => {
          const match = item.jobNumber.match(/^JC-\\d{4}-(\\d+)$/)
          return match ? Math.max(max, Number(match[1]) || 0) : max
        }, 0)
        let sequence = highest + 1
        let jobNumber = `${prefix}${String(sequence).padStart(4, '0')}`
        while (await tx.workshopJobCard.findUnique({ where: { jobNumber }, select: { id: true } })) {
          sequence++
          jobNumber = `${prefix}${String(sequence).padStart(4, '0')}`
        }
        const id = `jc_${randomUUID()}`
        await tx.workshopJobCard.create({
          data: {
            id, jobNumber, serviceDate: eventAt, serviceType: 'TIRE MAINTENANCE',
            creationSource: 'TIRE', priority: 'NORMAL', status: 'OPEN',
            driverName: driverName || undefined,
            reportedIssue: 'Tire usage recorded; source vehicle could not be resolved',
            notes: `${marker} ${sourceDetails} Vehicle assignment pending review.`,
            createdById: user.id, items: [], checklist: {}
          }
        })
        unassignedCardCache.set(marker, id)
        return id
      }

      for (const tire of unresolvedSourceTires) {
        const note = String(tire.notes || '')
        const match = note.match(/Unlinked source rows[^:]*:\\s*(.+?) row (\\d+): date=([^,]+), vehicle=([^,]+), driver=([^,]+), serial=(.*), qty=(\\d+), history=/)
        if (!match) { skipped++; continue }
        const [, sheetName, sourceLine, dateText, vehicleText, driverText, serialText, quantityText] = match
        const eventAt = new Date(dateText)
        if (Number.isNaN(eventAt.getTime())) { skipped++; continue }
        const sourceKey = `${sheetName.trim()}: row ${sourceLine}`
        const eventNote = `Imported from ${sheetName.trim()}, row ${sourceLine}. Source serial cell: ${serialText.trim()}. Source quantity: ${quantityText}.`
        const existingSourceEvent = await tx.$queryRawUnsafe<any[]>(
          `SELECT "id" FROM "tire_lifecycle_events" WHERE "tireId"=$1 AND "eventType"='ISSUE' AND "notes" LIKE $2 LIMIT 1`,
          tire.id, `Imported from ${sheetName.trim()}, row ${sourceLine}.%`
        )
        if (existingSourceEvent.length) continue

        const vehicleMatch = vehicleText.trim().match(/^(truck|trailer)\\s+(.+)$/i)
        const sourceVehicleNumber = vehicleMatch?.[2]?.trim() || vehicleText.trim()
        const normalizedNumber = sourceVehicleNumber.toUpperCase().replace(/[^A-Z0-9]/g, '')
        let vehicle: { vehicleType: VehicleType; vehicleId: string } | null = null
        let trailerNumber: string | null = null
        if (normalizedNumber && vehicleMatch) {
          const [truckMatches, trailerMatches] = await Promise.all([
            tx.$queryRawUnsafe<any[]>(`SELECT "id" FROM "trucks" WHERE regexp_replace(upper("licensePlate"),'[^A-Z0-9]','','g')=$1 ORDER BY "isDeleted" ASC LIMIT 2`, normalizedNumber),
            tx.$queryRawUnsafe<any[]>(`SELECT "id","number" FROM "trailers" WHERE regexp_replace(upper("number"),'[^A-Z0-9]','','g')=$1 ORDER BY "isDeleted" ASC LIMIT 2`, normalizedNumber)
          ])
          const preferred = vehicleMatch[1].toLowerCase() === 'truck' ? truckMatches : trailerMatches
          const alternate = vehicleMatch[1].toLowerCase() === 'truck' ? trailerMatches : truckMatches
          const selected = preferred.length === 1 ? { type: vehicleMatch[1].toLowerCase() as VehicleType, row: preferred[0] }
            : preferred.length === 0 && alternate.length === 1 ? { type: vehicleMatch[1].toLowerCase() === 'truck' ? 'trailer' as const : 'truck' as const, row: alternate[0] }
            : null
          if (selected) {
            vehicle = { vehicleType: selected.type, vehicleId: selected.row.id }
            if (selected.type === 'trailer') trailerNumber = selected.row.number
          }
        }

        let jobCardId: string
        if (vehicle) {
          jobCardId = await getOrCreateOpenJobCard(tx, vehicle, {
            eventAt, driverName: driverText.trim() || tire.driverName || null, userId: user.id,
            creationSource: 'TIRE', serviceType: 'TIRE MAINTENANCE',
            reportedIssue: 'Tire usage imported from the original tire workbook',
            allowInactive: true
          })
        } else {
          const marker = `[TIRE-SOURCE:${sheetName.trim()}:${sourceLine}:${sourceVehicleNumber}]`
          jobCardId = await getUnassignedCard(eventAt, marker,
            `Original workbook vehicle: ${sourceVehicleNumber || 'not supplied'}. Source: ${sourceKey}. Serial: ${serialText.trim()}.`,
            driverText.trim() || tire.driverName || null)
        }

        await tx.$executeRawUnsafe(`
          INSERT INTO "tire_lifecycle_events"
          ("id","tireId","eventType","eventAt","toTruckId","toTrailerId","driverNameSnapshot","reason","notes","jobCardId","createdById")
          VALUES ($1,$2,'ISSUE',$3,$4,$5,$6,'Tire usage workbook import',$7,$8,$9)
        `, `tireevt_${randomUUID()}`, tire.id, eventAt,
          vehicle?.vehicleType === 'truck' ? vehicle.vehicleId : null,
          vehicle?.vehicleType === 'trailer' ? vehicle.vehicleId : null,
          driverText.trim() || tire.driverName || null,
          eventNote + (vehicle ? '' : ` Original vehicle number: ${sourceVehicleNumber || 'not supplied'}; vehicle assignment unresolved.`),
          jobCardId, user.id)

        if (vehicle) {
          await tx.$executeRawUnsafe(`
            INSERT INTO "tire_usage_periods" ("id","tireId","vehicleType","vehicleId","installedAt","historicalEndUnknown","driverNameSnapshot")
            SELECT $1,$2,$3,$4,$5,TRUE,$6
            WHERE NOT EXISTS (SELECT 1 FROM "tire_usage_periods" WHERE "tireId"=$2 AND "vehicleType"=$3 AND "vehicleId"=$4 AND "installedAt"=$5)
          `, `tyuse_${randomUUID()}`, tire.id, vehicle.vehicleType, vehicle.vehicleId, eventAt, driverText.trim() || tire.driverName || null)
          if (vehicle.vehicleType === 'truck') {
            await tx.$executeRawUnsafe(`UPDATE "tires" SET "truckId"=$2,"trailerNumber"=NULL,"lifecycleStatus"='ASSIGNED_UNVERIFIED',"updatedAt"=NOW() WHERE "id"=$1`, tire.id, vehicle.vehicleId)
          } else {
            await tx.$executeRawUnsafe(`UPDATE "tires" SET "truckId"=NULL,"trailerNumber"=$2,"lifecycleStatus"='ASSIGNED_UNVERIFIED',"updatedAt"=NOW() WHERE "id"=$1`, tire.id, trailerNumber || sourceVehicleNumber)
          }
        } else {
          await tx.$executeRawUnsafe(`UPDATE "tires" SET "lifecycleStatus"='ASSIGNED_UNVERIFIED',"updatedAt"=NOW() WHERE "id"=$1`, tire.id)
        }
        linked++
      }

      const tireEvents = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","eventType","eventAt","fromTruckId","fromTrailerId","toTruckId","toTrailerId","driverNameSnapshot","odometerKm","reason","cost"
        FROM "tire_lifecycle_events"
        WHERE "jobCardId" IS NULL AND "eventType"<>'RECEIVE'
        ORDER BY "eventAt" ASC
      `)
      for (const row of tireEvents) {
        const sourceVehicle = row.fromTruckId ? { vehicleType: 'truck' as const, vehicleId: row.fromTruckId }
          : row.fromTrailerId ? { vehicleType: 'trailer' as const, vehicleId: row.fromTrailerId } : null
        const targetVehicle = row.toTruckId ? { vehicleType: 'truck' as const, vehicleId: row.toTruckId }
          : row.toTrailerId ? { vehicleType: 'trailer' as const, vehicleId: row.toTrailerId } : null
        const vehicle = ['REMOVE','DAMAGE','REPAIR','INSPECT','DISPOSE'].includes(String(row.eventType)) ? sourceVehicle || targetVehicle : targetVehicle || sourceVehicle
        if (!vehicle) { skipped++; continue }
        try {
          const jobCardId = await getOrCreateOpenJobCard(tx, vehicle, {
            eventAt: row.eventAt, odometerKm: row.odometerKm, driverName: row.driverNameSnapshot,
            userId: user.id, creationSource: 'TIRE', serviceType: 'TIRE MAINTENANCE',
            reportedIssue: row.reason || `Linked from existing tire ${row.eventType} event`
          })
          const attached = await tx.$queryRawUnsafe<any[]>('UPDATE "tire_lifecycle_events" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL RETURNING "id"', row.id, jobCardId)
          if (attached.length) {
            const cost = Number(row.cost || 0)
            if (cost > 0) await tx.$executeRawUnsafe('UPDATE "workshop_job_cards" SET "partsCost"=COALESCE("partsCost",0)+$2,"totalCost"=COALESCE("totalCost",0)+$2,"updatedAt"=NOW() WHERE "id"=$1', jobCardId, cost)
            linked++
          }
        } catch { skipped++ }
      }
      return { linked, skipped }
    }, { timeout: 120000 })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check and sync job cards'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    console.error('Job card reconciliation error:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
