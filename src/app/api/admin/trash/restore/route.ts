import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = requireAdmin(request)
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
            deletedBy: null
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

    return NextResponse.json({
      message: `${type} restored successfully`,
      item: restoredItem
    })
  } catch (error) {
    console.error('Error restoring item:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to restore item' },
      { status: 500 }
    )
  }
}