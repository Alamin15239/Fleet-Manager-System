import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { cleanJobCardPayload } from '@/lib/job-card-validation'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { reconcileJobCardInventory } from '@/lib/job-card-inventory'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRolePermission(request, 'maintenance', 'update')
    const { id } = await params
    const data = cleanJobCardPayload(await request.json())
    const vehicleExists = data.truckId
      ? await db.truck.findFirst({ where: { id: data.truckId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
      : await db.trailer.findFirst({ where: { id: data.trailerId!, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
    if (!vehicleExists) return NextResponse.json({ error: 'Selected vehicle was not found or is inactive' }, { status: 400 })
    const jobCard = await db.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`
      const existing = await tx.workshopJobCard.findUnique({ where: { id }, select: { id: true, truckId: true, trailerId: true, status: true } })
      if (!existing) throw new Error('Job card not found')
      const targetTruckId = data.truckId !== undefined ? data.truckId : existing.truckId
      const targetTrailerId = data.trailerId !== undefined ? data.trailerId : existing.trailerId
      const targetStatus = data.status || existing.status
      if (['OPEN', 'IN_PROGRESS'].includes(targetStatus) && (targetTruckId || targetTrailerId)) {
        const vehicleWhere = targetTruckId ? { truckId: targetTruckId } : { trailerId: targetTrailerId! }
        const conflictingCard = await tx.workshopJobCard.findFirst({
          where: { ...vehicleWhere, id: { not: id }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
          select: { id: true, jobNumber: true }
        })
        if (conflictingCard) throw new Error(`Another open job card (${conflictingCard.jobNumber}) already exists for this vehicle`)
      }
      const updated = await tx.workshopJobCard.update({
        where: { id }, data,
        include: {
          truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
          trailer: { select: { id: true, number: true } }
        }
      })
      if (targetTruckId && Number.isInteger(data.odometerKm) && data.odometerKm! >= 0) {
        await tx.$executeRawUnsafe(
          `UPDATE "trucks" SET "currentMileage" = GREATEST("currentMileage", $2), "updatedAt" = NOW()
           WHERE "id" = $1 AND "isDeleted" = false`,
          data.truckId, data.odometerKm
        )
      }
      await reconcileJobCardInventory(tx, {
        jobCardId: id, lines: updated.status === 'CANCELLED' ? [] : data.items as any[],
        vehicleType: targetTruckId ? 'truck' : 'trailer', vehicleId: targetTruckId || targetTrailerId!,
        transactionDate: data.serviceDate, userId: user.id
      })
      return updated
    })
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({ jobCard })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update job card'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : message.startsWith('Another open job card') ? 409 : message.startsWith('Select ') || message.startsWith('Enter ') || message.startsWith('Service ') ? 400 : 500
    console.error('Job card update error:', error)
    return NextResponse.json({ error: status === 500 ? 'Failed to update job card' : message }, { status })
  }
}
