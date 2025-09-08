import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET single maintenance record by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Try to find in truck maintenance records first
    let maintenanceRecord = await db.maintenanceRecord.findUnique({
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
        }
      }
    })

    // If not found in truck records, try trailer records
    if (!maintenanceRecord) {
      maintenanceRecord = await db.trailerMaintenanceRecord.findUnique({
        where: { 
          id: id,
          isDeleted: false 
        },
        include: {
          trailer: {
            select: {
              id: true,
              number: true,
              status: true,
              driverName: true
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
          }
        }
      })
    }

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

    // Check if maintenance record exists in truck records
    let existingRecord = await db.maintenanceRecord.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    let recordType = 'truck'

    // If not found in truck records, check trailer records
    if (!existingRecord) {
      existingRecord = await db.trailerMaintenanceRecord.findUnique({
        where: { 
          id: id,
          isDeleted: false 
        }
      })
      recordType = 'trailer'
    }

    if (!existingRecord) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 }
      )
    }

    // Calculate total cost
    const partsCost = body.partsCost !== undefined ? parseFloat(body.partsCost) : existingRecord.partsCost
    const laborCost = body.laborCost !== undefined ? parseFloat(body.laborCost) : existingRecord.laborCost
    const totalCost = partsCost + laborCost

    // Update maintenance record based on type
    let updatedRecord
    
    if (recordType === 'truck') {
      updatedRecord = await db.maintenanceRecord.update({
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
          ...(body.nextServiceDue !== undefined && { nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : null }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.attachments !== undefined && { attachments: body.attachments }),
          ...(body.isOilChange !== undefined && { isOilChange: body.isOilChange }),
          ...(body.oilChangeInterval !== undefined && { oilChangeInterval: body.oilChangeInterval ? parseInt(body.oilChangeInterval) : null }),
          ...(body.oilQuantityLiters !== undefined && { oilQuantityLiters: body.oilQuantityLiters ? parseFloat(body.oilQuantityLiters) : null }),
          ...(body.currentMileage !== undefined && { currentMileage: body.currentMileage ? parseInt(body.currentMileage) : null }),
          ...(body.maintenanceJobId !== undefined && { maintenanceJobId: body.maintenanceJobId || null })
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
    } else {
      updatedRecord = await db.trailerMaintenanceRecord.update({
        where: { id: id },
        data: {
          ...(body.truckId !== undefined && { trailerId: body.truckId }),
          ...(body.serviceType !== undefined && { serviceType: body.serviceType }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.datePerformed !== undefined && { datePerformed: new Date(body.datePerformed) }),
          ...(body.partsCost !== undefined && { partsCost }),
          ...(body.laborCost !== undefined && { laborCost }),
          totalCost,
          ...(body.mechanicId !== undefined && { mechanicId: body.mechanicId || null }),
          ...(body.nextServiceDue !== undefined && { nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : null }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.attachments !== undefined && { attachments: body.attachments }),
          ...(body.maintenanceJobId !== undefined && { maintenanceJobId: body.maintenanceJobId || null })
        },
        include: {
          trailer: {
            select: {
              id: true,
              number: true,
              status: true,
              driverName: true
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
    
    // Check if maintenance record exists in truck records
    let record = await db.maintenanceRecord.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    let recordType = 'truck'

    // If not found in truck records, check trailer records
    if (!record) {
      record = await db.trailerMaintenanceRecord.findUnique({
        where: { 
          id: id,
          isDeleted: false 
        }
      })
      recordType = 'trailer'
    }

    if (!record) {
      return NextResponse.json(
        { error: 'Maintenance record not found' },
        { status: 404 }
      )
    }

    // Soft delete maintenance record based on type
    if (recordType === 'truck') {
      await db.maintenanceRecord.update({
        where: { id: id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: 'system'
        }
      })
    } else {
      await db.trailerMaintenanceRecord.update({
        where: { id: id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: 'system'
        }
      })
    }

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