import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

// GET single truck by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRolePermission(request, 'trucks', 'read')
    const { id } = await params;
    const truck = await db.truck.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      },
      include: {
        maintenanceRecords: {
          orderBy: { datePerformed: 'desc' },
          take: 50
        },
        predictiveAlerts: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },

        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: truck
    })

  } catch (error) {
    console.error('Error fetching truck:', error)
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Access denied' : 'Failed to fetch truck' },
      { status: unauthorized ? 401 : forbidden ? 403 : 500 }
    )
  }
}

// PUT update truck
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRolePermission(request, 'trucks', 'update')
    const { id } = await params;
    const body = await request.json()

    // Check if truck exists
    const existingTruck = await db.truck.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    if (!existingTruck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      )
    }

    // Check if VIN is being changed and already exists
    if (body.vin && body.vin !== existingTruck.vin) {
      const vinExists = await db.truck.findFirst({
        where: { 
          vin: body.vin,
          NOT: { id: id }
        }
      })

      if (vinExists) {
        return NextResponse.json(
          { error: 'Truck with this VIN already exists' },
          { status: 400 }
        )
      }
    }

    // Check if license plate is being changed and already exists
    if (body.licensePlate && body.licensePlate !== existingTruck.licensePlate) {
      const plateExists = await db.truck.findFirst({
        where: { 
          licensePlate: body.licensePlate,
          NOT: { id: id }
        }
      })

      if (plateExists) {
        return NextResponse.json(
          { error: 'Truck with this license plate already exists' },
          { status: 400 }
        )
      }
    }

    // Update truck
    const updatedTruck = await db.truck.update({
      where: { id: id },
      data: {
        ...(body.vin && { vin: body.vin }),
        ...(body.make && { make: body.make }),
        ...(body.model && { model: body.model }),
        ...(body.year && { year: parseInt(body.year) }),
        ...(body.licensePlate && { licensePlate: body.licensePlate }),
        ...(body.currentMileage !== undefined && { currentMileage: parseInt(body.currentMileage) }),
        ...(body.status && { status: body.status }),
        ...(body.fuelEfficiency !== undefined && { fuelEfficiency: body.fuelEfficiency ? parseFloat(body.fuelEfficiency) : null }),
        ...(body.engineHours !== undefined && { engineHours: body.engineHours ? parseInt(body.engineHours) : null }),
        ...(body.driverName !== undefined && { driverName: body.driverName }),
        ...(body.image !== undefined && { image: body.image }),
        ...(body.healthScore !== undefined && { healthScore: body.healthScore ? parseFloat(body.healthScore) : null }),
        ...(body.riskLevel !== undefined && { riskLevel: body.riskLevel }),
        ...(body.avgDailyMileage !== undefined && { avgDailyMileage: body.avgDailyMileage ? parseFloat(body.avgDailyMileage) : null }),
        ...(body.lastOilChange !== undefined && { lastOilChange: body.lastOilChange ? new Date(body.lastOilChange) : null }),
        ...(body.nextOilChange !== undefined && { nextOilChange: body.nextOilChange ? new Date(body.nextOilChange) : null }),
        ...(body.lastInspection !== undefined && { lastInspection: body.lastInspection ? new Date(body.lastInspection) : null }),
        ...(body.nextInspection !== undefined && { nextInspection: body.nextInspection ? new Date(body.nextInspection) : null }),
        ...(body.locationLat !== undefined && { locationLat: body.locationLat ? parseFloat(body.locationLat) : null }),
        ...(body.locationLng !== undefined && { locationLng: body.locationLng ? parseFloat(body.locationLng) : null }),
        ...(body.isOnline !== undefined && { isOnline: body.isOnline }),
        ...(body.lastPing !== undefined && { lastPing: body.lastPing ? new Date(body.lastPing) : null })
      },
      include: {
        maintenanceRecords: {
          orderBy: { datePerformed: 'desc' },
          take: 5
        },
        predictiveAlerts: {
          where: { isResolved: false },
          take: 3,
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    await syncOneDriveWorkbookAfterChange()

    return NextResponse.json({
      success: true,
      data: updatedTruck,
      message: 'Truck updated successfully'
    })

  } catch (error) {
    console.error('Error updating truck:', error)
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Manager access required' : 'Failed to update truck' },
      { status: unauthorized ? 401 : forbidden ? 403 : 500 }
    )
  }
}

// DELETE truck (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRolePermission(request, 'trucks', 'delete')
    const { id } = await params;
    // Check if truck exists
    const truck = await db.truck.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      )
    }

    // Soft delete truck
    await db.truck.update({
      where: { id: id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: 'system' // In real app, get from auth context
      }
    })

    await syncOneDriveWorkbookAfterChange()

    return NextResponse.json({
      success: true,
      message: 'Truck deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting truck:', error)
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Manager access required' : 'Failed to delete truck' },
      { status: unauthorized ? 401 : forbidden ? 403 : 500 }
    )
  }
}
