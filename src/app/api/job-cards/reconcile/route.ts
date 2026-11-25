import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { ensureMaintenanceJobCardColumns, getOrCreateOpenJobCard } from '@/lib/tire-lifecycle'

type VehicleType = 'truck' | 'trailer'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'maintenance', 'update')
    const result = await db.$transaction(async tx => {
      await ensureMaintenanceJobCardColumns(tx)
      let linked = 0
      let skipped = 0

      const maintenance = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","truckId","datePerformed","currentMileage","driverName","serviceType","description"
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
          await tx.$executeRawUnsafe('UPDATE "maintenance_records" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL', row.id, jobCardId)
          linked++
        } catch { skipped++ }
      }

      const trailerMaintenance = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","trailerId","datePerformed","driverName","serviceType","description"
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
          await tx.$executeRawUnsafe('UPDATE "trailer_maintenance_records" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL', row.id, jobCardId)
          linked++
        } catch { skipped++ }
      }

      const issues = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","vehicleType","vehicleId","transactionDate","notes"
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
          await tx.$executeRawUnsafe('UPDATE "inventory_transactions" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL', row.id, jobCardId)
          linked++
        } catch { skipped++ }
      }

      const tireEvents = await tx.$queryRawUnsafe<any[]>(`
        SELECT "id","eventType","eventAt","fromTruckId","fromTrailerId","toTruckId","toTrailerId","driverNameSnapshot","odometerKm","reason"
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
          await tx.$executeRawUnsafe('UPDATE "tire_lifecycle_events" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL', row.id, jobCardId)
          linked++
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
