import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { type, id } = body

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type and ID are required' },
        { status: 400 }
      )
    }

    let restoredItem

    switch (type) {
      case 'user':
        restoredItem = await db.user.update({
          where: { id },
          data: {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null,
            isActive: true
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            isApproved: true,
            createdAt: true,
            updatedAt: true
          }
        })
        break

      case 'truck':
        restoredItem = await db.truck.update({
          where: { id },
          data: {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          },
          select: {
            id: true,
            vin: true,
            make: true,
            model: true,
            year: true,
            licensePlate: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        })
        break

      case 'mechanic':
        restoredItem = await db.mechanic.update({
          where: { id },
          data: {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            specialty: true,
            isActive: true,
            createdAt: true,
            updatedAt: true
          }
        })
        break

      case 'maintenance':
        restoredItem = await db.maintenanceRecord.update({
          where: { id },
          data: {
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          },
          select: {
            id: true,
            serviceType: true,
            datePerformed: true,
            totalCost: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            truck: {
              select: {
                id: true,
                vin: true,
                make: true,
                model: true,
                licensePlate: true
              }
            }
          }
        })
        break

      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be user, truck, mechanic, or maintenance' },
          { status: 400 }
        )
    }

    if (type === 'truck' || type === 'maintenance' || type === 'mechanic') await syncOneDriveWorkbookAfterChange()

    return NextResponse.json({
      message: `${type} restored successfully`,
      item: restoredItem
    })
  } catch (error) {
    console.error('Error restoring item:', error)
    const message = error instanceof Error ? error.message : ''
    const unauthorized = ['No token provided', 'Invalid token', 'Unauthorized'].includes(message)
    const forbidden = message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Failed to restore item' },
      { status: unauthorized ? 401 : forbidden ? 403 : 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
