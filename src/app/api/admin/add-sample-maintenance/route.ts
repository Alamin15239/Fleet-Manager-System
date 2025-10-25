import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { MaintenanceStatus } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    // Get the first truck from the database
    const truck = await db.truck.findFirst({
      where: { isDeleted: false }
    })

    if (!truck) {
      return NextResponse.json(
        { error: 'No trucks found. Please add a truck first.' },
        { status: 404 }
      )
    }

    // Sample maintenance records
    const sampleRecords: any[] = [
      {
        truckId: truck.id,
        serviceType: "Oil Change",
        description: "Regular oil change and filter replacement",
        datePerformed: new Date("2024-12-01"),
        partsCost: 45.00,
        laborCost: 35.00,
        totalCost: 80.00,
        status: MaintenanceStatus.COMPLETED,
        notes: "Used synthetic oil, next change due in 5000 km",
        isOilChange: true,
        oilChangeInterval: 5000,
        currentMileage: truck.currentMileage || 415032
      },
      {
        truckId: truck.id,
        serviceType: "Brake Inspection",
        description: "Routine brake system inspection and pad replacement",
        datePerformed: new Date("2024-11-15"),
        partsCost: 120.00,
        laborCost: 80.00,
        totalCost: 200.00,
        status: MaintenanceStatus.COMPLETED,
        notes: "Front brake pads replaced, rear pads still good"
      },
      {
        truckId: truck.id,
        serviceType: "Tire Rotation",
        description: "Tire rotation and pressure check",
        datePerformed: new Date("2024-11-01"),
        partsCost: 0.00,
        laborCost: 25.00,
        totalCost: 25.00,
        status: MaintenanceStatus.COMPLETED,
        notes: "All tires rotated, pressure adjusted to specification"
      },
      {
        truckId: truck.id,
        serviceType: "Engine Diagnostic",
        description: "Check engine light diagnostic",
        datePerformed: new Date("2024-10-20"),
        partsCost: 15.00,
        laborCost: 60.00,
        totalCost: 75.00,
        status: MaintenanceStatus.COMPLETED,
        notes: "Replaced faulty oxygen sensor, cleared error codes"
      },
      {
        truckId: truck.id,
        serviceType: "Transmission Service",
        description: "Transmission fluid change and filter replacement",
        datePerformed: new Date("2024-10-05"),
        partsCost: 85.00,
        laborCost: 120.00,
        totalCost: 205.00,
        status: MaintenanceStatus.COMPLETED,
        notes: "Transmission fluid and filter changed, system running smoothly"
      },
      {
        truckId: truck.id,
        serviceType: "Air Filter Replacement",
        description: "Engine air filter replacement",
        datePerformed: new Date("2024-09-15"),
        partsCost: 25.00,
        laborCost: 20.00,
        totalCost: 45.00,
        status: MaintenanceStatus.COMPLETED,
        notes: "Air filter was dirty, replaced with new OEM filter"
      }
    ]

    // Create all maintenance records
    const createdRecords = []
    for (const record of sampleRecords) {
      const maintenanceRecord = await db.maintenanceRecord.create({
        data: {
          ...record,
          vehicleName: `${truck.year} ${truck.make} ${truck.model}`,
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
              currentMileage: true
            }
          }
        }
      })
      createdRecords.push(maintenanceRecord)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdRecords.length} sample maintenance records`,
      data: createdRecords,
      truck: {
        id: truck.id,
        licensePlate: truck.licensePlate,
        make: truck.make,
        model: truck.model,
        year: truck.year
      }
    })

  } catch (error) {
    console.error('Error creating sample maintenance records:', error)
    return NextResponse.json(
      { error: 'Failed to create sample maintenance records' },
      { status: 500 }
    )
  }
}