import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all maintenance records
export async function GET(request: NextRequest) {
  try {
    // Test database connection first
    try {
      await db.$queryRaw`SELECT 1`
    } catch (dbError) {
      console.error('Database connection failed:', dbError)
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 },
        summary: { stats: [], predictedStats: { _count: { _all: 0 } }, totalCost: 0, totalDowntime: 0, averageCost: 0 }
      })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const truckId = searchParams.get('truckId')
    const mechanicId = searchParams.get('mechanicId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const wasPredicted = searchParams.get('wasPredicted')

    const skip = (page - 1) * limit

    const whereClause: any = {
      isDeleted: false
    }

    if (search) {
      whereClause.OR = [
        { serviceType: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (truckId) {
      whereClause.truckId = truckId
    }

    if (mechanicId) {
      whereClause.mechanicId = mechanicId
    }

    if (dateFrom) {
      whereClause.datePerformed = {
        gte: new Date(dateFrom)
      }
    }

    if (dateTo) {
      whereClause.datePerformed = {
        ...(whereClause.datePerformed || {}),
        lte: new Date(dateTo)
      }
    }

    if (wasPredicted !== null) {
      whereClause.wasPredicted = wasPredicted === 'true'
    }

    // Get both truck and trailer maintenance records
    const [truckRecords, trailerRecords, truckCount, trailerCount] = await Promise.all([
      db.maintenanceRecord.findMany({
        where: whereClause,
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
        },
        orderBy: { datePerformed: 'desc' },
        skip,
        take: limit
      }),
      db.trailerMaintenanceRecord.findMany({
        where: whereClause.truckId ? { ...whereClause, trailerId: whereClause.truckId } : whereClause,
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
        },
        orderBy: { datePerformed: 'desc' },
        skip,
        take: limit
      }),
      db.maintenanceRecord.count({ where: whereClause }),
      db.trailerMaintenanceRecord.count({ where: whereClause.truckId ? { ...whereClause, trailerId: whereClause.truckId } : whereClause })
    ])

    // Combine and sort records
    const allRecords = [...truckRecords, ...trailerRecords].sort((a, b) => 
      new Date(b.datePerformed).getTime() - new Date(a.datePerformed).getTime()
    )

    const totalCount = truckCount + trailerCount

    return NextResponse.json({
      success: true,
      data: allRecords,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        stats: [],
        predictedStats: { _count: { _all: 0 } },
        totalCost: 0,
        totalDowntime: 0,
        averageCost: 0
      }
    })

  } catch (error) {
    console.error('Error fetching maintenance records:', error)
    // Return empty data instead of 500 error
    return NextResponse.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      summary: { stats: [], predictedStats: { _count: { _all: 0 } }, totalCost: 0, totalDowntime: 0, averageCost: 0 }
    })
  }
}

// POST create new maintenance record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    const requiredFields = ['truckId', 'serviceType', 'datePerformed', 'status']
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Check if vehicle exists (truck or trailer)
    let vehicle = null
    let vehicleType = 'truck'
    
    // First try to find as truck
    vehicle = await db.truck.findUnique({
      where: { 
        id: body.truckId,
        isDeleted: false 
      }
    })
    
    // If not found as truck, try as trailer
    if (!vehicle) {
      vehicle = await db.trailer.findUnique({
        where: { 
          id: body.truckId,
          isDeleted: false 
        }
      })
      vehicleType = 'trailer'
    }

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Calculate total cost
    const partsCost = parseFloat(body.partsCost) || 0
    const laborCost = parseFloat(body.laborCost) || 0
    const totalCost = partsCost + laborCost

    // Create maintenance record based on vehicle type
    let maintenanceRecord
    
    // Get mechanic name for historical data
    let mechanicName = null
    if (body.mechanicId) {
      const mechanic = await db.mechanic.findUnique({
        where: { id: body.mechanicId },
        select: { name: true }
      })
      mechanicName = mechanic?.name
    }
    
    if (vehicleType === 'truck') {
      maintenanceRecord = await db.maintenanceRecord.create({
        data: {
          truckId: body.truckId,
          serviceType: body.serviceType,
          description: body.description,
          datePerformed: new Date(body.datePerformed),
          partsCost,
          laborCost,
          totalCost,
          mechanicId: body.mechanicId || null,
          createdById: body.createdById || null,
          nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : null,
          status: body.status,
          notes: body.notes,
          attachments: body.attachments,
          isOilChange: body.isOilChange || false,
          oilChangeInterval: body.oilChangeInterval ? parseInt(body.oilChangeInterval) : null,
          currentMileage: body.currentMileage ? parseInt(body.currentMileage) : null,
          maintenanceJobId: body.maintenanceJobId || null,
          wasPredicted: body.wasPredicted || false,
          predictionId: body.predictionId,
          downtimeHours: body.downtimeHours ? parseFloat(body.downtimeHours) : null,
          failureMode: body.failureMode,
          rootCause: body.rootCause,
          vehicleName: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          mechanicName,
          driverName: vehicle.driverName
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
      maintenanceRecord = await db.trailerMaintenanceRecord.create({
        data: {
          trailerId: body.truckId,
          serviceType: body.serviceType,
          description: body.description,
          datePerformed: new Date(body.datePerformed),
          partsCost,
          laborCost,
          totalCost,
          mechanicId: body.mechanicId || null,
          createdById: body.createdById || null,
          nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : null,
          status: body.status,
          notes: body.notes,
          attachments: body.attachments,
          maintenanceJobId: body.maintenanceJobId || null,
          wasPredicted: body.wasPredicted || false,
          predictionId: body.predictionId,
          downtimeHours: body.downtimeHours ? parseFloat(body.downtimeHours) : null,
          failureMode: body.failureMode,
          rootCause: body.rootCause,
          vehicleName: `Trailer ${vehicle.number}`,
          mechanicName,
          driverName: vehicle.driverName
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
      data: maintenanceRecord,
      message: 'Maintenance record created successfully'
    })

  } catch (error) {
    console.error('Error creating maintenance record:', error)
    return NextResponse.json(
      { error: 'Failed to create maintenance record' },
      { status: 500 }
    )
  }
}