import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { cleanJobCardPayload } from '@/lib/job-card-validation'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { reconcileJobCardInventory } from '@/lib/job-card-inventory'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'read')
    const trackingView = new URL(request.url).searchParams.get('tracking') === '1'
    const cardsQuery = trackingView
      ? db.workshopJobCard.findMany({
          select: {
            id: true, jobNumber: true, truckId: true, trailerId: true, serviceDate: true,
            serviceType: true, status: true, nextServiceOdometer: true, nextServiceDate: true, createdAt: true,
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
          orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
          take: 500
        })
    const [jobCards, settings] = await Promise.all([cardsQuery, db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } })])
    return NextResponse.json({ jobCards, company: settings })
  } catch (error) {
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
    const jobCard = await db.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`
      const count = await tx.workshopJobCard.count({ where: { jobNumber: { startsWith: prefix } } })
      const created = await tx.workshopJobCard.create({
        data: { ...data, jobNumber: `${prefix}${String(count + 1).padStart(4, '0')}`, createdById: user.id },
        include: {
          truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
          trailer: { select: { id: true, number: true } }
        }
      })
      // Only touch the inventory ledger when this job card actually issues
      // a catalogued stock item. Manual parts/labour lines must remain usable
      // even when the optional inventory tables or integration are unavailable.
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
      return created
    })
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({ jobCard }, { status: 201 })
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
