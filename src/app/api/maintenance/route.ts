import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all maintenance records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const whereClause = { isDeleted: false }

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
          }
        },
        orderBy: { datePerformed: 'desc' },
        skip,
        take: limit
      }),
      db.maintenanceRecord.count({ where: whereClause })
    ])

    const totalCost = records.reduce((sum, record) => sum + (record.totalCost || 0), 0)

    return NextResponse.json({
      success: true,
      records,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        totalCost,
        totalDowntime: 0,
        averageCost: totalCount > 0 ? totalCost / totalCount : 0,
        predictedCount: 0,
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
        status: body.status || 'COMPLETED',
        notes: body.notes || null,
        currentMileage: body.currentMileage ? parseInt(body.currentMileage) : null,
        mechanicName: body.mechanicName || null,
        driverName: body.driverName || null
      },
      include: {
        truck: true
      }
    })

    return NextResponse.json(maintenanceRecord)

  } catch (error) {
    console.error('Error creating maintenance record:', error)
    return NextResponse.json(
      { error: 'Failed to create maintenance record' },
      { status: 500 }
    )
  }
}