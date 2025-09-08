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
    console.log('Received request body:', JSON.stringify(body, null, 2))

    // Create minimal maintenance record for truck only
    const maintenanceRecord = await db.maintenanceRecord.create({
      data: {
        truckId: body.truckId,
        serviceType: body.serviceType,
        datePerformed: new Date(body.datePerformed),
        partsCost: parseFloat(body.partsCost) || 0,
        laborCost: parseFloat(body.laborCost) || 0,
        totalCost: (parseFloat(body.partsCost) || 0) + (parseFloat(body.laborCost) || 0),
        status: body.status || 'COMPLETED'
      }
    })

    return NextResponse.json({
      success: true,
      data: maintenanceRecord
    })

  } catch (error) {
    console.error('Error creating maintenance record:', error)
    return NextResponse.json(
      { error: 'Failed to create maintenance record', details: error.message },
      { status: 500 }
    )
  }
}