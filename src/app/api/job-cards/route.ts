import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { cleanJobCardPayload } from '@/lib/job-card-validation'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { reconcileJobCardInventory } from '@/lib/job-card-inventory'
import { ensureMaintenanceJobCardColumns } from '@/lib/tire-lifecycle'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'read')
    // The read endpoint must not run tire/inventory schema migrations or
    // backfill jobs. Those writes belong to the module setup/write paths.
    // Keep only the central Job Card bootstrap required by legacy databases.
    await ensureMaintenanceJobCardColumns(db)
    const trackingView = new URL(request.url).searchParams.get('tracking') === '1'
    const cardsQuery = trackingView
      ? db.workshopJobCard.findMany({
          select: {
            id: true, jobNumber: true, truckId: true, trailerId: true, serviceDate: true,
            serviceType: true, creationSource: true, items: true, status: true, nextServiceOdometer: true, nextServiceDate: true, createdAt: true,
            truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
            trailer: { select: { id: true, number: true } }
          },
          orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }]
        })
      : db.workshopJobCard.findMany({
          include: {
            truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
            trailer: { select: { id: true, number: true } }
          },
          orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }]
        })
    const [savedJobCards, settings] = await Promise.all([cardsQuery, db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } })])
    // Older oil-import workflows incorrectly materialized oil changes as
    // standalone Job Cards. Hide only those legacy, unclassified oil-only
    // records from Job Card views; retain the underlying oil history and all
    // explicitly manual/workbook Job Cards.
    const jobCards = savedJobCards.filter((card: any) => {
      const legacyUnknownSource = String(card.creationSource || 'UNKNOWN').toUpperCase() === 'UNKNOWN'
      const oilOnlyService = /oil[\s_-]*change/i.test(String(card.serviceType || ''))
      const hasNoJobCardLines = !Array.isArray(card.items) || card.items.length === 0
      return !(legacyUnknownSource && oilOnlyService && hasNoJobCardLines)
    })
    let activitySummary = {
      oil: { total: 0 }, tires: { total: 0 }, spareParts: { total: 0 }, total: 0
    }
    try {
      const activityRows = await db.$queryRawUnsafe<any[]>(`
        SELECT
          (SELECT COUNT(*) FROM "maintenance_records" WHERE "isDeleted"=false AND "isOilChange"=true)::int AS "oilTotal",
          (SELECT COUNT(*) FROM "tire_lifecycle_events" WHERE "eventType"<>'RECEIVE')::int AS "tireTotal",
          (SELECT COUNT(*) FROM "inventory_transactions" WHERE "type"='ISSUE')::int AS "partsTotal"
      `)
      const activity = activityRows[0] || {}
      const oil = { total: Number(activity.oilTotal || 0) }
      const tires = { total: Number(activity.tireTotal || 0) }
      const spareParts = { total: Number(activity.partsTotal || 0) }
      activitySummary = { oil, tires, spareParts, total: oil.total + tires.total + spareParts.total }
    } catch (activityError) {
      // Optional module counters must never prevent the central Job Card
      // register from loading. The underlying records remain untouched.
      console.warn('Job card activity summary unavailable:', activityError)
    }
    return NextResponse.json({ jobCards, company: settings, activitySummary })
  } catch (error) {
    console.error('Job card list API failed:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch job cards'
    return NextResponse.json({ error: message }, { status: message.includes('token') ? 401 : message === 'Insufficient permissions' ? 403 : 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'maintenance', 'create')
    const data = cleanJobCardPayload(await request.json())
    const vehicleExists = data.truckId
      ? await db.truck.findFirst({ where: { id: data.truckId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
      : await db.trailer.findFirst({ where: { id: data.trailerId!, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
    if (!vehicleExists) return NextResponse.json({ error: 'Selected vehicle was not found or is inactive' }, { status: 400 })

    const year = data.serviceDate.getFullYear()
    const prefix = `JC-${year}-`
    const result = await db.$transaction(async tx => {
      await ensureMaintenanceJobCardColumns(tx)
      await tx.$executeRaw`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`
      const vehicleWhere = data.truckId ? { truckId: data.truckId } : { trailerId: data.trailerId! }
      const openCard = await tx.workshopJobCard.findFirst({
        where: { ...vehicleWhere, status: { in: ['OPEN', 'IN_PROGRESS'] } },
        orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }]
      })
      if (openCard) {
        const existingItems = Array.isArray(openCard.items) ? openCard.items as any[] : []
        const mergedItems = [...existingItems, ...(data.items as any[])]
        const joinText = (a?: string | null, b?: string | null) => [a, b].filter(Boolean).join('\n')
        const updated = await tx.workshopJobCard.update({
          where: { id: openCard.id },
          data: {
            items: mergedItems,
            reportedIssue: joinText(openCard.reportedIssue, data.reportedIssue),
            notes: joinText(openCard.notes, data.notes),
            technicianName: data.technicianName || openCard.technicianName,
            driverName: data.driverName || openCard.driverName,
            odometerKm: data.odometerKm == null ? openCard.odometerKm : Math.max(openCard.odometerKm || 0, data.odometerKm),
            partsCost: Number(openCard.partsCost || 0) + Number(data.partsCost || 0),
            laborCost: Number(openCard.laborCost || 0) + Number(data.laborCost || 0),
            totalCost: Number(openCard.totalCost || 0) + Number(data.totalCost || 0),
            nextServiceOdometer: data.nextServiceOdometer ?? openCard.nextServiceOdometer,
            nextServiceDate: data.nextServiceDate ?? openCard.nextServiceDate
          },
          include: {
            truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
            trailer: { select: { id: true, number: true } }
          }
        })
        if (data.truckId && Number.isInteger(data.odometerKm) && data.odometerKm! >= 0) {
          await tx.$executeRawUnsafe(
            `UPDATE "trucks" SET "currentMileage" = GREATEST("currentMileage", $2), "updatedAt" = NOW()
             WHERE "id" = $1 AND "isDeleted" = false`,
            data.truckId, data.odometerKm
          )
        }
        await reconcileJobCardInventory(tx, {
          jobCardId: updated.id, lines: mergedItems,
          vehicleType: data.truckId ? 'truck' : 'trailer', vehicleId: data.truckId || data.trailerId!,
          transactionDate: data.serviceDate, userId: user.id
        })
        return { jobCard: updated, reusedExisting: true }
      }
      // Count-based numbering can reuse an existing number after deletions or
      // gaps. Find the highest numeric suffix and increment it instead.
      const existingNumbers = await tx.workshopJobCard.findMany({
        where: { jobNumber: { startsWith: prefix } },
        select: { jobNumber: true }
      })
      const highestSequence = existingNumbers.reduce((highest, card) => {
        const match = card.jobNumber.match(/^JC-\d{4}-(\d+)$/)
        const sequence = match ? Number(match[1]) : 0
        return Number.isSafeInteger(sequence) ? Math.max(highest, sequence) : highest
      }, 0)
      const nextJobNumber = `${prefix}${String(highestSequence + 1).padStart(4, '0')}`
      const created = await tx.workshopJobCard.create({
        data: { ...data, jobNumber: nextJobNumber, creationSource: 'MANUAL', createdById: user.id },
        include: {
          truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
          trailer: { select: { id: true, number: true } }
        }
      })
      // Only touch the inventory ledger when this job card actually issues
      // a catalogued stock item. Manual parts/labour lines must remain usable
      // even when the optional inventory tables or integration are unavailable.
      if (data.truckId && Number.isInteger(data.odometerKm) && data.odometerKm! >= 0) {
        await tx.$executeRawUnsafe(
          `UPDATE "trucks" SET "currentMileage" = GREATEST("currentMileage", $2), "updatedAt" = NOW()
           WHERE "id" = $1 AND "isDeleted" = false`,
          data.truckId, data.odometerKm
        )
      }
      const hasTrackedParts = (data.items as any[]).some(
        item => item.type === 'PART' && typeof item.inventoryItemId === 'string' && item.inventoryItemId
      )
      if (created.status !== 'CANCELLED' && hasTrackedParts) {
        await reconcileJobCardInventory(tx, {
          jobCardId: created.id, lines: data.items as any[],
          vehicleType: data.truckId ? 'truck' : 'trailer', vehicleId: data.truckId || data.trailerId!,
          transactionDate: data.serviceDate, userId: user.id
        })
      }
      return { jobCard: created, reusedExisting: false }
    })
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json(result, { status: result.reusedExisting ? 200 : 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job card'
    const isInsufficientStock = message.startsWith('Insufficient stock for')
    const isInventoryValidation = message.startsWith('Inventory item not found') ||
      message.startsWith('Enter a valid quantity for each inventory part')
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401
      : message === 'Insufficient permissions' ? 403
      : isInsufficientStock ? 409
      : isInventoryValidation || message.startsWith('Select ') || message.startsWith('Enter ') || message.startsWith('Service ') ? 400
      : 500
    console.error('Job card create error:', error)
    return NextResponse.json({ error: status === 500 ? 'Failed to create job card. Please check the server logs or contact support.' : message }, { status })
  }
}
