import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    
    // Get all deleted users
    const deletedUsers = await db.user.findMany({
      where: {
        isDeleted: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        deletedAt: true,
        deletedBy: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        deletedAt: 'desc'
      }
    })

    // Get all deleted trucks
    const deletedTrucks = await db.truck.findMany({
      where: {
        isDeleted: true
      },
      select: {
        id: true,
        vin: true,
        make: true,
        model: true,
        year: true,
        licensePlate: true,
        status: true,
        deletedAt: true,
        deletedBy: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        deletedAt: 'desc'
      }
    })

    // Get all deleted mechanics
    const deletedMechanics = await db.mechanic.findMany({
      where: {
        isDeleted: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        specialty: true,
        isActive: true,
        deletedAt: true,
        deletedBy: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        deletedAt: 'desc'
      }
    })

    // Get all deleted maintenance records
    const deletedMaintenanceRecords = await db.maintenanceRecord.findMany({
      where: {
        isDeleted: true
      },
      select: {
        id: true,
        serviceType: true,
        datePerformed: true,
        totalCost: true,
        status: true,
        deletedAt: true,
        deletedBy: true,
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
      },
      orderBy: {
        deletedAt: 'desc'
      }
    })

    return NextResponse.json({
      users: deletedUsers,
      trucks: deletedTrucks,
      mechanics: deletedMechanics,
      maintenanceRecords: deletedMaintenanceRecords
    })
  } catch (error) {
    console.error('Error fetching trash items:', error)
    const message = error instanceof Error ? error.message : ''
    const unauthorized = ['No token provided', 'Invalid token', 'Unauthorized'].includes(message)
    const forbidden = message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Failed to fetch trash items' },
      { status: unauthorized ? 401 : forbidden ? 403 : 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
