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

    const [maintenanceRecords, totalCount] = await Promise.all([
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
      db.maintenanceRecord.count({ where: whereClause })
    ])

    // Calculate summary statistics
    const stats = await db.maintenanceRecord.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        status: true
      },
      _sum: {
        totalCost: true,
        partsCost: true,
        laborCost: true,
        downtimeHours: true
      },
      _avg: {
        totalCost: true,
        downtimeHours: true
      }
    })

    const predictedStats = await db.maintenanceRecord.aggregate({
      where: {
        ...whereClause,
        wasPredicted: true
      },
      _count: {
        _all: true
      },
      _sum: {
        totalCost: true,
        downtimeHours: true
      }
    })

    return NextResponse.json({
      success: true,
      data: maintenanceRecords,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        stats,
        predictedStats,
        totalCost: stats.reduce((sum, stat) => sum + (stat._sum.totalCost || 0), 0),
        totalDowntime: stats.reduce((sum, stat) => sum + (stat._sum.downtimeHours || 0), 0),
        averageCost: stats.reduce((sum, stat) => sum + (stat._avg.totalCost || 0), 0) / stats.length || 0
      }
    })

  } catch (error) {
    console.error('Error fetching maintenance records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch maintenance records' },
      { status: 500 }
    )
  }
}

// POST create new maintenance record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Add timeout protection for database operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timeout')), 8000)
    })

    // Validate required fields
    const requiredFields = ['truckId', 'serviceType', 'datePerformed', 'partsCost', 'laborCost', 'status']
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
    vehicle = await Promise.race([
      db.truck.findUnique({
        where: { 
          id: body.truckId,
          isDeleted: false 
        }
      }),
      timeoutPromise
    ])
    
    // If not found as truck, try as trailer
    if (!vehicle) {
      vehicle = await Promise.race([
        db.trailer.findUnique({
          where: { 
            id: body.truckId,
            isDeleted: false 
          }
        }),
        timeoutPromise
      ])
      vehicleType = 'trailer'
    }

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    // Check if mechanic exists (if provided)
    if (body.mechanicId) {
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
    const partsCost = parseFloat(body.partsCost) || 0
    const laborCost = parseFloat(body.laborCost) || 0
    const totalCost = partsCost + laborCost

    // Create maintenance record
    const maintenanceData: any = {
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
      maintenanceJobId: body.maintenanceJobId,
      wasPredicted: body.wasPredicted || false,
      predictionId: body.predictionId,
      downtimeHours: body.downtimeHours ? parseFloat(body.downtimeHours) : null,
      failureMode: body.failureMode,
      rootCause: body.rootCause
    }
    
    // Add vehicle reference based on type
    if (vehicleType === 'truck') {
      maintenanceData.truckId = body.truckId
    } else {
      maintenanceData.trailerId = body.truckId
    }
    
    const maintenanceRecord = await Promise.race([
      db.maintenanceRecord.create({
        data: maintenanceData,
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
      }),
      timeoutPromise
    ])

    // Update truck's next service due if this is an oil change
    if (body.isOilChange && body.oilChangeInterval && body.currentMileage) {
      const nextOilChangeMileage = parseInt(body.currentMileage) + parseInt(body.oilChangeInterval)
      const nextOilChangeDate = new Date(body.datePerformed)
      nextOilChangeDate.setDate(nextOilChangeDate.getDate() + 90) // Default 90 days

      await db.truck.update({
        where: { id: body.truckId },
        data: {
          nextOilChange: nextOilChangeDate,
          lastOilChange: new Date(body.datePerformed)
        }
      })
    }

    // Resolve predictive alert if this maintenance was predicted
    if (body.wasPredicted && body.predictionId) {
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
      data: maintenanceRecord,
      message: 'Maintenance record created successfully'
    })

  } catch (error) {
    console.error('Error creating maintenance record:', error)
    if (error.message === 'Database operation timeout') {
      return NextResponse.json(
        { error: 'Database connection timeout. Please try again.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create maintenance record' },
      { status: 500 }
    )
  }
}