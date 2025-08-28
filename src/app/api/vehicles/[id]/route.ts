import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/vehicles/[id] - Get single vehicle
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const vehicle = await db.vehicle.findUnique({
      where: { id: context.params.id }
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ vehicle })
  } catch (error) {
    console.error('Error fetching vehicle:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vehicle' },
      { status: 500 }
    )
  }
}

// PUT /api/vehicles/[id] - Update vehicle
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { plateNumber, trailerNumber, driverName, isActive } = body

    // Check if vehicle exists
    const existingVehicle = await db.vehicle.findUnique({
      where: { id: context.params.id }
    })

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Check if plate number is being changed and already exists
    if (plateNumber && plateNumber !== existingVehicle.plateNumber) {
      const plateExists = await db.vehicle.findUnique({
        where: { plateNumber }
      })

      if (plateExists) {
        return NextResponse.json(
          { error: 'Vehicle with this plate number already exists' },
          { status: 400 }
        )
      }
    }

    const vehicle = await db.vehicle.update({
      where: { id: context.params.id },
      data: {
        ...(plateNumber && { plateNumber }),
        ...(trailerNumber !== undefined && { trailerNumber: trailerNumber || null }),
        ...(driverName !== undefined && { driverName: driverName || null }),
        ...(isActive !== undefined && { isActive })
      }
    })

    return NextResponse.json({ vehicle })
  } catch (error) {
    console.error('Error updating vehicle:', error)
    
    if (error instanceof Error && error.message === 'No token provided') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update vehicle' },
      { status: 500 }
    )
  }
}

// DELETE /api/vehicles/[id] - Delete vehicle
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const user = await requireAuth(request)

    // Check if vehicle exists
    const existingVehicle = await db.vehicle.findUnique({
      where: { id: context.params.id }
    })

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Check if vehicle has associated tires
    const tireCount = await db.tire.count({
      where: { plateNumber: existingVehicle.plateNumber }
    })

    if (tireCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete vehicle with associated tires. Please remove tires first.' },
        { status: 400 }
      )
    }

    await db.vehicle.delete({
      where: { id: context.params.id }
    })

    return NextResponse.json({ 
      message: 'Vehicle deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting vehicle:', error)
    
    if (error instanceof Error && error.message === 'No token provided') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete vehicle' },
      { status: 500 }
    )
  }
}