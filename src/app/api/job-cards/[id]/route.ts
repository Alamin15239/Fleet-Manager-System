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
      const existing = await tx.workshopJobCard.findUnique({ where: { id }, select: { id: true } })
      if (!existing) throw new Error('Job card not found')
      const updated = await tx.workshopJobCard.update({
        where: { id }, data,
        include: {
          truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
          trailer: { select: { id: true, number: true } }
        }
      })
      await reconcileJobCardInventory(tx, {
        jobCardId: id, lines: updated.status === 'CANCELLED' ? [] : data.items as any[],
        vehicleType: data.truckId ? 'truck' : 'trailer', vehicleId: data.truckId || data.trailerId!,
        transactionDate: data.serviceDate, userId: user.id
      })
      return updated
    })
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({ jobCard })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update job card'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : message.startsWith('Select ') || message.startsWith('Enter ') || message.startsWith('Service ') ? 400 : 500
    console.error('Job card update error:', error)
    return NextResponse.json({ error: status === 500 ? 'Failed to update job card' : message }, { status })
  }
}
