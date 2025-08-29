import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET single maintenance record by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const maintenanceRecord = await db.maintenanceRecord.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      },
      include: {
        truck: {
          select: {
            id: true,
            vin: true,
            make: true,
            model: true,
            year: true,
            licensePlate: true,
            currentMileage: true,
            status: true
          }
        },
        mechanic: {
          select: {
            id: true,
            name: true,
            specialty: true,
            email: true,
            phone: true
          }
        },
        maintenanceJob: {
          select: {
            id: true,
            name: true,
            category: true,
            parts: true,
            notes: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        predictiveAlert: {
          select: {
            id: true,
            alertType: true,
            title: true,
            description: true,
            severity: true,
            confidence: true,
            predictedFailureDate: true,
            recommendedAction: true,
            costImpact: true,
            probability: true
          }
        }
      }
    })

    if (!maintenanceRecord) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: maintenanceRecord
    })

  } catch (error) {
    console.error('Error fetching maintenance record:', error)
    return NextResponse.json(
      { error: 'Failed to fetch maintenance record' },
      { status: 500 }
    )
  }
}

// PUT update maintenance record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json()

    // Check if maintenance record exists
    const existingRecord = await db.maintenanceRecord.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    if (!existingRecord) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 }
      )
    }

    // Check if truck exists (if truckId is being changed)
    if (body.truckId && body.truckId !== existingRecord.truckId) {
      const truck = await db.truck.findUnique({
        where: { 
          id: body.truckId,
          isDeleted: false 
        }
      })

      if (!truck) {
        return NextResponse.json(
          { error: 'Truck not found' },
          { status: 404 }
        )
      }
    }

    // Check if mechanic exists (if mechanicId is being changed)
    if (body.mechanicId && body.mechanicId !== existingRecord.mechanicId) {
      const mechanic = await db.mechanic.findUnique({
        where: { 
          id: body.mechanicId,
          isDeleted: false 
        }
      })

      if (!mechanic) {
        return NextResponse.json(
          { error: 'Mechanic not found' },
          { status: 404 }
        )
      }
    }

    // Calculate total cost
    const partsCost = body.partsCost !== undefined ? parseFloat(body.partsCost) : existingRecord.partsCost
    const laborCost = body.laborCost !== undefined ? parseFloat(body.laborCost) : existingRecord.laborCost
    const totalCost = partsCost + laborCost

    // Update maintenance record
    const updatedRecord = await db.maintenanceRecord.update({
      where: { id: id },
      data: {
        ...(body.truckId !== undefined && { truckId: body.truckId }),
        ...(body.serviceType !== undefined && { serviceType: body.serviceType }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.datePerformed !== undefined && { datePerformed: new Date(body.datePerformed) }),
        ...(body.partsCost !== undefined && { partsCost }),
        ...(body.laborCost !== undefined && { laborCost }),
        totalCost,
        ...(body.mechanicId !== undefined && { mechanicId: body.mechanicId || null }),
        ...(body.createdById !== undefined && { createdById: body.createdById || null }),
        ...(body.nextServiceDue !== undefined && { nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.attachments !== undefined && { attachments: body.attachments }),
        ...(body.isOilChange !== undefined && { isOilChange: body.isOilChange }),
        ...(body.oilChangeInterval !== undefined && { oilChangeInterval: body.oilChangeInterval ? parseInt(body.oilChangeInterval) : null }),
        ...(body.currentMileage !== undefined && { currentMileage: body.currentMileage ? parseInt(body.currentMileage) : null }),
        ...(body.maintenanceJobId !== undefined && { maintenanceJobId: body.maintenanceJobId }),
        ...(body.wasPredicted !== undefined && { wasPredicted: body.wasPredicted }),
        ...(body.predictionId !== undefined && { predictionId: body.predictionId }),
        ...(body.downtimeHours !== undefined && { downtimeHours: body.downtimeHours ? parseFloat(body.downtimeHours) : null }),
        ...(body.failureMode !== undefined && { failureMode: body.failureMode }),
        ...(body.rootCause !== undefined && { rootCause: body.rootCause })
      },
      include: {
        truck: {
          select: {
            id: true,
            vin: true,
            make: true,
            model: true,
            year: true,
            licensePlate: true,
            currentMileage: true
          }
        },
        mechanic: {
          select: {
            id: true,
            name: true,
            specialty: true
          }
        },
        maintenanceJob: {
          select: {
            id: true,
            name: true,
            category: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Update truck's oil change information if this is an oil change
    if (body.isOilChange && body.oilChangeInterval && body.currentMileage) {
      const nextOilChangeMileage = parseInt(body.currentMileage) + parseInt(body.oilChangeInterval)
      const nextOilChangeDate = new Date(body.datePerformed || existingRecord.datePerformed)
      nextOilChangeDate.setDate(nextOilChangeDate.getDate() + 90) // Default 90 days

      await db.truck.update({
        where: { id: body.truckId || existingRecord.truckId },
        data: {
          nextOilChange: nextOilChangeDate,
          lastOilChange: new Date(body.datePerformed || existingRecord.datePerformed)
        }
      })
    }

    // Resolve predictive alert if this maintenance was predicted
    if (body.wasPredicted && body.predictionId && !existingRecord.isResolved) {
      await db.predictiveAlert.update({
        where: { id: body.predictionId },
        data: {
          isResolved: true,
          resolvedAt: new Date(),
          resolvedBy: body.createdById || 'system'
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: 'Maintenance record updated successfully'
    })

  } catch (error) {
    console.error('Error updating maintenance record:', error)
    return NextResponse.json(
      { error: 'Failed to update maintenance record' },
      { status: 500 }
    )
  }
}

// DELETE maintenance record (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if maintenance record exists
    const record = await db.maintenanceRecord.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    if (!record) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 }
      )
    }

    // Soft delete maintenance record
    await db.maintenanceRecord.update({
      where: { id: id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: 'system' // In real app, get from auth context
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Maintenance record deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting maintenance record:', error)
    return NextResponse.json(
      { error: 'Failed to delete maintenance record' },
      { status: 500 }
    )
  }
}