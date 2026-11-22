import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { reconcileOilChangeInventory } from '@/lib/job-card-inventory'
import { ensureMaintenanceJobCardColumns, getOrCreateOpenJobCard } from '@/lib/tire-lifecycle'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'read')
    await db.$transaction(async tx => ensureMaintenanceJobCardColumns(tx))
    // Get both truck and trailer maintenance records
    const [truckRecords, trailerRecords] = await Promise.all([
      db.maintenanceRecord.findMany({
        include: {
          truck: true
        },
        orderBy: { datePerformed: 'desc' }
      }),
      db.trailerMaintenanceRecord.findMany({
        include: {
          trailer: true
        },
        orderBy: { datePerformed: 'desc' }
      }).catch(() => []) // Return empty array if trailer table doesn't exist
    ])

    // Attach the currently selected inventory oil item to each oil-change record for editing.
    let oilItemByRecord = new Map<string, string>()
    try {
      const linked = await db.$queryRawUnsafe<any[]>(
        `SELECT "sourceId", "itemId"
         FROM "inventory_transactions"
         WHERE "sourceType"='OIL_CHANGE'
         GROUP BY "sourceId", "itemId"
         HAVING SUM(CASE WHEN "type"='ISSUE' THEN "quantity" WHEN "type"='CUSTOMER_RETURN' THEN -"quantity" ELSE 0 END)>0`
      )
      oilItemByRecord = new Map(linked.map(row => [String(row.sourceId), String(row.itemId)]))
    } catch (error) {
      // Existing installations without oil inventory linkage remain readable.
      console.warn('Oil inventory links are not available yet:', error)
    }

    // Combine and format records
    const allRecords = [
      ...truckRecords.map(record => ({ ...record, oilInventoryItemId: oilItemByRecord.get(record.id) || null })),
      ...trailerRecords.map(record => ({
        ...record,
        // Add truck field for compatibility
        truck: {
          id: record.trailer?.id || '',
          vin: '',
          make: 'Trailer',
          model: record.trailer?.number || '',
          year: 0,
          licensePlate: `Trailer ${record.trailer?.number || ''}`,
          currentMileage: 0
        }
      }))
    ].sort((a, b) => new Date(b.datePerformed).getTime() - new Date(a.datePerformed).getTime())

    return NextResponse.json({
      success: true,
      records: allRecords,
      pagination: { page: 1, limit: 100, total: allRecords.length, pages: 1 },
      summary: {
        totalCost: allRecords.reduce((sum, r) => sum + (r.totalCost || 0), 0),
        completedCount: allRecords.filter(r => r.status === 'COMPLETED').length,
        inProgressCount: allRecords.filter(r => r.status === 'IN_PROGRESS').length,
        scheduledCount: allRecords.filter(r => r.status === 'SCHEDULED').length
      }
    })
  } catch (error) {
    console.error('Maintenance error:', error)
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json({ success: false, error: unauthorized ? 'Authentication required' : forbidden ? 'Access denied' : 'Failed to fetch maintenance records' }, { status: unauthorized ? 401 : forbidden ? 403 : 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'maintenance', 'create')
    const body = await request.json()

    // Check if the selected vehicle is a trailer by checking if it exists in trailer table
    let isTrailer = false
    try {
      const trailer = body.truckId ? await db.trailer.findUnique({ where: { id: body.truckId } }) : null
      isTrailer = !!trailer
    } catch (e) {
      // If trailer table doesn't exist, treat as truck
      isTrailer = false
    }
    
    let record
    if (isTrailer) {
      // Create trailer maintenance record
      record = await db.$transaction(async tx => {
        await ensureMaintenanceJobCardColumns(tx)
        const created = await tx.trailerMaintenanceRecord.create({
          data: {
            trailerId: body.truckId,
            serviceType: body.serviceType,
            description: body.description,
            datePerformed: new Date(body.datePerformed),
            partsCost: parseFloat(body.partsCost) || 0,
            laborCost: parseFloat(body.laborCost) || 0,
            totalCost: (parseFloat(body.partsCost) || 0) + (parseFloat(body.laborCost) || 0),
            mechanicId: body.mechanicId || null,
            mechanicName: body.mechanicName || null,
            driverName: body.driverName || null,
            status: body.status || 'COMPLETED'
          }
        })
        const jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType: 'trailer', vehicleId: body.truckId }, {
          eventAt: new Date(body.datePerformed), driverName: body.driverName || null, userId: user.id,
          serviceType: body.serviceType || 'TRAILER MAINTENANCE',
          reportedIssue: body.description || 'Automatically linked trailer maintenance activity'
        })
        await tx.$executeRawUnsafe(`UPDATE "trailer_maintenance_records" SET "jobCardId"=$2 WHERE "id"=$1`, created.id, jobCardId)
        return { ...created, jobCardId }
      })
    } else {
      // Create truck maintenance record
      const data = {
        truckId: body.truckId || null,
        vehiclePlateNumber: body.vehiclePlateNumber || null,
        serviceType: body.serviceType,
        description: body.description,
        datePerformed: new Date(body.datePerformed),
        partsCost: parseFloat(body.partsCost) || 0,
        laborCost: parseFloat(body.laborCost) || 0,
        totalCost: (parseFloat(body.partsCost) || 0) + (parseFloat(body.laborCost) || 0),
        status: body.status || 'COMPLETED',
        mechanicId: body.mechanicId || null,
        mechanicName: body.mechanicName || null,
        driverName: body.driverName || null,
        isOilChange: body.isOilChange || false,
        oilQuantityLiters: body.oilQuantityLiters ? parseFloat(body.oilQuantityLiters) : null,
        oilChangeInterval: body.oilChangeInterval ? parseInt(body.oilChangeInterval) : null,
        currentMileage: body.currentMileage ? parseInt(body.currentMileage) : null,
        nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : null,
        notes: body.notes || null
      }
      record = await db.$transaction(async tx => {
        await ensureMaintenanceJobCardColumns(tx)
        const created = await tx.maintenanceRecord.create({ data })
        const jobCardId = body.truckId ? await getOrCreateOpenJobCard(tx, { vehicleType: 'truck', vehicleId: body.truckId }, {
          eventAt: new Date(body.datePerformed), odometerKm: Number.isInteger(Number(body.currentMileage)) ? Number(body.currentMileage) : null,
          driverName: body.driverName || null, userId: user.id,
          serviceType: body.serviceType || (body.isOilChange ? 'OIL CHANGE' : 'MAINTENANCE'),
          reportedIssue: body.description || 'Automatically linked maintenance activity'
        }) : null
        if (jobCardId) await tx.$executeRawUnsafe(`UPDATE "maintenance_records" SET "jobCardId"=$2 WHERE "id"=$1`, created.id, jobCardId)
        if (body.isOilChange && body.oilInventoryItemId && body.truckId) {
          await reconcileOilChangeInventory(tx, {
            maintenanceId: created.id,
            inventoryItemId: body.oilInventoryItemId,
            quantityLiters: body.oilQuantityLiters,
            transactionDate: new Date(body.datePerformed),
            vehicleId: body.truckId,
            userId: user.id,
            jobCardId
          })
        }
        if (body.truckId) {
          const mileageValue = Number(body.currentMileage)
          const mileage = Number.isInteger(mileageValue) && mileageValue >= 0 ? mileageValue : null
          const isOilChange = body.isOilChange === true || /oil/i.test(String(body.serviceType || ''))
          await tx.$executeRawUnsafe(
            `UPDATE "trucks"
             SET "currentMileage" = CASE WHEN $2::integer IS NULL THEN "currentMileage" ELSE GREATEST("currentMileage", $2::integer) END,
                 "lastOilChange" = CASE WHEN $3::boolean AND ("lastOilChange" IS NULL OR "lastOilChange" < $4) THEN $4 ELSE "lastOilChange" END,
                 "updatedAt" = NOW()
             WHERE "id" = $1 AND "isDeleted" = false`,
            body.truckId, mileage, isOilChange, new Date(body.datePerformed)
          )
        }
        return { ...created, jobCardId }
      })
    }

    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json(record)
  } catch (error) {
    console.error('Maintenance POST error:', error)
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    const insufficient = error instanceof Error && error.message.includes('Insufficient oil stock')
    return NextResponse.json({ error: unauthorized ? 'Authentication required' : forbidden ? 'Manager access required' : error instanceof Error ? error.message : 'Failed to create record' }, { status: unauthorized ? 401 : forbidden ? 403 : insufficient ? 409 : error instanceof Error && error.message.includes('Selected vehicle was not found') ? 400 : 500 })
  }
}
