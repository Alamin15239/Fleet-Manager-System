import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/tires/[id] - Get single tire
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tire = await db.tire.findUnique({
      where: { id: id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!tire) {
      return NextResponse.json(
        { error: 'Tire not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ tire })
  } catch (error) {
    console.error('Error fetching tire:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tire' },
      { status: 500 }
    )
  }
}

// PUT /api/tires/[id] - Update tire
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth(request)
    const body = await request.json()
    const { 
      tireSize, 
      manufacturer, 
      origin, 
      plateNumber, 
      trailerNumber, 
      driverName, 
      quantity, 
      serialNumber,
      notes 
    } = body

    // Check if tire exists
    const existingTire = await db.tire.findUnique({
      where: { id: id }
    })

    if (!existingTire) {
      return NextResponse.json(
        { error: 'Tire not found' },
        { status: 404 }
      )
    }

    // Update the tire
    const updatedTire = await db.tire.update({
      where: { id: id },
      data: {
        ...(tireSize && { tireSize }),
        ...(manufacturer && { manufacturer }),
        ...(origin && { origin }),
        ...(plateNumber && { plateNumber }),
        ...(trailerNumber !== undefined && { trailerNumber: trailerNumber || null }),
        ...(driverName !== undefined && { driverName: driverName || null }),
        ...(quantity !== undefined && { quantity }),
        ...(serialNumber !== undefined && { serialNumber: serialNumber || null }),
        ...(notes !== undefined && { notes: notes || null })
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // If plate number changed, update the vehicle as well
    if (plateNumber && plateNumber !== existingTire.plateNumber) {
      // Check if vehicle exists for new plate number
      let vehicle = await db.vehicle.findUnique({
        where: { plateNumber }
      })

      if (!vehicle) {
        // Create new vehicle
        vehicle = await db.vehicle.create({
          data: {
            plateNumber,
            trailerNumber: trailerNumber || null,
            driverName: driverName || null
          }
        })
      } else {
        // Update existing vehicle
        await db.vehicle.update({
          where: { plateNumber },
          data: {
            ...(trailerNumber !== undefined && { trailerNumber: trailerNumber || null }),
            ...(driverName !== undefined && { driverName: driverName || null })
          }
        })
      }
    }

    return NextResponse.json({ 
      tire: updatedTire,
      message: 'Tire updated successfully' 
    })
  } catch (error) {
    console.error('Error updating tire:', error)
    
    if (error instanceof Error && error.message === 'No token provided') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update tire' },
      { status: 500 }
    )
  }
}

// DELETE /api/tires/[id] - Delete tire
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth(request)

    // Check if tire exists
    const existingTire = await db.tire.findUnique({
      where: { id: id }
    })

    if (!existingTire) {
      return NextResponse.json(
        { error: 'Tire not found' },
        { status: 404 }
      )
    }

    // Delete the tire
    await db.tire.delete({
      where: { id: id }
    })

    return NextResponse.json({ 
      message: 'Tire deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting tire:', error)
    
    if (error instanceof Error && error.message === 'No token provided') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete tire' },
      { status: 500 }
    )
  }
}