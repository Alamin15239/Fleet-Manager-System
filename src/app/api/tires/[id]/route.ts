import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { ensureTireLifecycleTables, recordTireLifecycleEvent } from '@/lib/tire-lifecycle'

// GET /api/tires/[id] - Get single tire
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePermission(request, 'tire-management', 'read')
    if (authResult instanceof NextResponse) return authResult
    await db.$transaction(async tx => ensureTireLifecycleTables(tx))
    const { id } = await params;
    const tire = await db.tire.findFirst({
      where: { id: id, deletedAt: null },
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
    const authResult = await requirePermission(request, 'tire-management', 'update')
    if (authResult instanceof NextResponse) return authResult
    await db.$transaction(async tx => ensureTireLifecycleTables(tx))
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
    const existingTire = await db.tire.findFirst({
      where: { id: id, deletedAt: null }
    })

    if (!existingTire) {
      return NextResponse.json(
        { error: 'Tire not found' },
        { status: 404 }
      )
    }

    if ((plateNumber !== undefined && plateNumber !== existingTire.plateNumber) ||
        (trailerNumber !== undefined && trailerNumber !== existingTire.trailerNumber)) {
      return NextResponse.json({ error: 'Use the Install or Transfer operation to change a tire vehicle assignment' }, { status: 409 })
    }
    if (quantity !== undefined && Number(quantity) !== 1) {
      return NextResponse.json({ error: 'Each tire is tracked as an individual record; quantity must remain 1' }, { status: 400 })
    }

    // Update tire specifications only; installation and movement are lifecycle events.
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

    await syncOneDriveWorkbookAfterChange()

    return NextResponse.json({ 
      tire: updatedTire,
      message: 'Tire updated successfully' 
    })
  } catch (error) {
    console.error('Error updating tire:', error)
    
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
    const authResult = await requirePermission(request, 'tire-management', 'delete')
    if (authResult instanceof NextResponse) return authResult
    await db.$transaction(async tx => ensureTireLifecycleTables(tx))

    // Check if tire exists
    const existingTire = await db.tire.findFirst({
      where: { id: id, deletedAt: null }
    })

    if (!existingTire) {
      return NextResponse.json(
        { error: 'Tire not found' },
        { status: 404 }
      )
    }

    // Permanent deletion is intentional: lifecycle events and usage periods
    // are dependent records and are removed by their ON DELETE CASCADE FKs.
    await db.$transaction(async tx => {
      await tx.tire.delete({ where: { id } })
    })

    await syncOneDriveWorkbookAfterChange()

    return NextResponse.json({
      message: 'Tire and its linked lifecycle and usage history were permanently deleted'
    })
  } catch (error) {
    console.error('Error deleting tire:', error)
    
    return NextResponse.json(
      { error: 'Failed to dispose tire' },
      { status: 500 }
    )
  }
}
