import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all oil change records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const skip = (page - 1) * limit

    const whereClause: any = {
      isDeleted: false,
      OR: [
        { isOilChange: true },
        { serviceType: { contains: 'oil', mode: 'insensitive' } },
        { description: { contains: 'oil', mode: 'insensitive' } }
      ]
    }

    if (search) {
      whereClause.AND = [
        whereClause.OR ? { OR: whereClause.OR } : {},
        {
          OR: [
            { truck: { licensePlate: { contains: search, mode: 'insensitive' } } },
            { truck: { make: { contains: search, mode: 'insensitive' } } },
            { truck: { model: { contains: search, mode: 'insensitive' } } },
            { driverName: { contains: search, mode: 'insensitive' } },
            { mechanicName: { contains: search, mode: 'insensitive' } },
            { mechanic: { name: { contains: search, mode: 'insensitive' } } }
          ]
        }
      ]
      delete whereClause.OR
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (dateFrom) {
      whereClause.datePerformed = { gte: new Date(dateFrom) }
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
          }
        },
        orderBy: { datePerformed: 'desc' },
        skip,
        take: limit
      }),
      db.maintenanceRecord.count({ where: whereClause })
    ])

    // Calculate statistics
    const totalCost = records.reduce((sum, record) => sum + (record.totalCost || 0), 0)
    const totalOilUsed = records.reduce((sum, record) => sum + (record.oilQuantityLiters || 0), 0)
    const completedCount = records.filter(r => r.status === 'COMPLETED').length
    const inProgressCount = records.filter(r => r.status === 'IN_PROGRESS').length
    const recordsWithOilQuantity = records.filter(r => r.oilQuantityLiters && r.oilQuantityLiters > 0).length

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      summary: {
        totalRecords: totalCount,
        totalCost,
        totalOilUsed,
        completedCount,
        inProgressCount,
        recordsWithOilQuantity,
        averageCost: totalCount > 0 ? totalCost / totalCount : 0,
        averageOilPerChange: recordsWithOilQuantity > 0 ? totalOilUsed / recordsWithOilQuantity : 0
      }
    })

  } catch (error) {
    console.error('Error fetching oil changes:', error)
    return NextResponse.json({
      success: true,
      data: [],
      pagination: { page: 1, limit: 50, total: 0, pages: 0 },
      summary: {
        totalRecords: 0,
        totalCost: 0,
        totalOilUsed: 0,
        completedCount: 0,
        inProgressCount: 0,
        recordsWithOilQuantity: 0,
        averageCost: 0,
        averageOilPerChange: 0
      }
    })
  }
}

// POST create new oil change record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const oilChangeRecord = await db.maintenanceRecord.create({
      data: {
        truckId: body.truckId,
        serviceType: body.serviceType || 'Oil Change',
        description: body.description || 'Regular oil change service',
        datePerformed: new Date(body.datePerformed),
        partsCost: parseFloat(body.partsCost) || 0,
        laborCost: parseFloat(body.laborCost) || 0,
        totalCost: (parseFloat(body.partsCost) || 0) + (parseFloat(body.laborCost) || 0),
        mechanicId: (body.mechanicId && body.mechanicId !== 'none') ? body.mechanicId : null,
        mechanicName: body.mechanicName || null,
        driverName: body.driverName || null,
        currentMileage: body.currentMileage ? parseInt(body.currentMileage) : null,
        status: body.status || 'COMPLETED',
        notes: body.notes || null,
        isOilChange: true,
        oilChangeInterval: body.oilChangeInterval ? parseInt(body.oilChangeInterval) : null,
        oilQuantityLiters: body.oilQuantityLiters ? parseFloat(body.oilQuantityLiters) : null,
        nextServiceDue: body.nextServiceDue ? new Date(body.nextServiceDue) : null,
        createdById: body.createdById || null
      },
      include: {
        truck: true,
        mechanic: true
      }
    })

    return NextResponse.json({
      success: true,
      data: oilChangeRecord
    })

  } catch (error) {
    console.error('Error creating oil change record:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create oil change record',
      details: error.message
    }, { status: 500 })
  }
}