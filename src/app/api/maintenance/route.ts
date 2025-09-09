import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all maintenance records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const truckId = searchParams.get('truckId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

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

    const [records, totalCount] = await Promise.all([
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
    const totalCost = records.reduce((sum, record) => sum + (record.totalCost || 0), 0)
    const totalDowntime = records.reduce((sum, record) => sum + (record.downtimeHours || 0), 0)
    const predictedCount = records.filter(record => record.wasPredicted).length
    
    // Format records for frontend
    const formattedRecords = records.map(record => ({
      ...record,
      mechanicName: record.mechanic?.name || record.mechanicName || null
    }))

    return NextResponse.json({
      success: true,
      records: formattedRecords,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        totalCost,
        totalDowntime,
        averageCost: totalCount > 0 ? totalCost / totalCount : 0,
        predictedCount,
        completedCount: records.filter(r => r.status === 'COMPLETED').length,
        inProgressCount: records.filter(r => r.status === 'IN_PROGRESS').length,
        scheduledCount: records.filter(r => r.status === 'SCHEDULED').length
      }
    })

  } catch (error) {
    console.error('Error fetching maintenance records:', error)
    return NextResponse.json({
      success: true,
      records: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 },
      summary: { totalCost: 0, totalDowntime: 0, averageCost: 0, predictedCount: 0, completedCount: 0, inProgressCount: 0, scheduledCount: 0 }
    })
  }
}

// POST create new maintenance record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const maintenanceRecord = await db.maintenanceRecord.create({
      data: {
        truckId: body.truckId,
        serviceType: body.serviceType,
        description: body.description || null,
        datePerformed: new Date(body.datePerformed),
        partsCost: parseFloat(body.partsCost) || 0,
        laborCost: parseFloat(body.laborCost) || 0,
        totalCost: (parseFloat(body.partsCost) || 0) + (parseFloat(body.laborCost) || 0),
        mechanicId: (body.mechanicId && body.mechanicId !== 'none') ? body.mechanicId : null,
        createdById: body.createdById || null,
        nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : null,
        status: body.status || 'COMPLETED',
        notes: body.notes || null,
        isOilChange: body.isOilChange || false,
        oilChangeInterval: body.oilChangeInterval ? parseInt(body.oilChangeInterval) : null,
        oilQuantityLiters: body.oilQuantityLiters ? parseFloat(body.oilQuantityLiters) : null,
        currentMileage: body.currentMileage ? parseInt(body.currentMileage) : null,
        mechanicName: body.mechanicName || null,
        driverName: body.driverName || null,
        wasPredicted: body.wasPredicted || false,
        downtimeHours: body.downtimeHours ? parseFloat(body.downtimeHours) : null
      },
      include: {
        truck: true,
        mechanic: true
      }
    })

    return NextResponse.json({
      ...maintenanceRecord,
      mechanicName: maintenanceRecord.mechanic?.name || maintenanceRecord.mechanicName
    })

  } catch (error) {
    console.error('Error creating maintenance record:', error)
    return NextResponse.json(
      { error: 'Failed to create maintenance record', details: error.message },
      { status: 500 }
    )
  }
}