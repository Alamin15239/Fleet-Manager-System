import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { logUserActivity } from '@/lib/activity-tracking'
import { logEntityChange } from '@/lib/audit-logging'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

// GET all trucks
export async function GET(request: NextRequest) {
  try {
    // Skip database connection test for trucks API

    const user = await requireRolePermission(request, 'trucks', 'read')
    
    // Log activity
    await logUserActivity({
      userId: user.id,
      action: 'VIEW',
      entityType: 'TRUCK',
      entityName: 'Truck List',
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: request.headers.get('user-agent') || ''
    })
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const skip = (page - 1) * limit

    const whereClause: any = {
      isDeleted: false
    }

    if (search) {
      whereClause.OR = [
        { vin: { contains: search } },
        { make: { contains: search } },
        { model: { contains: search } },
        { licensePlate: { contains: search } }
      ]
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (!includeInactive) {
      whereClause.status = { not: 'INACTIVE' }
    }

    // Return only actual fleet data. Synthetic vehicles make reports unreliable.
    try {
      const [trucks, totalCount] = await Promise.race([
        Promise.all([
          db.truck.findMany({
            where: whereClause,
            select: {
              id: true,
              vin: true,
              make: true,
              model: true,
              year: true,
              licensePlate: true,
              currentMileage: true,
              status: true,
              driverName: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
          }),
          db.truck.count({ where: whereClause })
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]) as [any[], number]

      return NextResponse.json({
        success: true,
        data: trucks,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      })
    } catch (error) {
      console.error('Truck database query failed:', error)
      return NextResponse.json({ success: false, error: 'Unable to load trucks. Please try again.' }, { status: 503 })
    }

  } catch (error) {
    console.error('Error fetching trucks:', error)
    if (error instanceof Error && (error.message === 'No token provided' || error.message === 'Invalid token')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    return NextResponse.json({ success: false, error: 'Unable to load trucks. Please try again.' }, { status: 503 })
  }
}

// POST create new truck
export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'trucks', 'create')
    const body = await request.json()

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Truck details are required' }, { status: 400 })
    }

    const vin = String(body.vin || '').trim()
    const make = String(body.make || '').trim()
    const model = String(body.model || '').trim()
    const licensePlate = String(body.licensePlate || '').trim()
    const year = Number(body.year)
    const currentMileage = Number(body.currentMileage ?? 0)
    const status = body.status || 'ACTIVE'

    if (!vin || !make || !model || !licensePlate) {
      return NextResponse.json({ error: 'VIN, make, model, and license plate are required' }, { status: 400 })
    }
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Enter a valid vehicle year' }, { status: 400 })
    }
    if (!Number.isInteger(currentMileage) || currentMileage < 0) {
      return NextResponse.json({ error: 'Mileage must be a non-negative whole number' }, { status: 400 })
    }
    if (!['ACTIVE', 'INACTIVE', 'MAINTENANCE'].includes(status)) {
      return NextResponse.json({ error: 'Invalid truck status' }, { status: 400 })
    }

    // Check if VIN already exists
    const existingTruck = await db.truck.findFirst({
      where: { 
        vin,
        isDeleted: false
      }
    })

    if (existingTruck) {
      return NextResponse.json(
        { error: 'Truck with this VIN already exists' },
        { status: 400 }
      )
    }

    // Check if license plate already exists
    const existingLicensePlate = await db.truck.findFirst({
      where: { 
        licensePlate,
        isDeleted: false
      }
    })

    if (existingLicensePlate) {
      return NextResponse.json(
        { error: 'Truck with this license plate already exists' },
        { status: 400 }
      )
    }

    // Create truck with timeout protection
    const truck = await Promise.race([
      db.truck.create({
      data: {
        vin,
        make,
        model,
        year,
        licensePlate,
        currentMileage,
        status,
        driverName: body.driverName || null,
        image: body.image,
        engineHours: body.engineHours ? parseInt(body.engineHours) : null,
        healthScore: body.healthScore ? parseFloat(body.healthScore) : null,
        riskLevel: body.riskLevel || 'LOW',
        fuelEfficiency: body.fuelEfficiency ? parseFloat(body.fuelEfficiency) : null,
        avgDailyMileage: body.avgDailyMileage ? parseFloat(body.avgDailyMileage) : null,
        lastOilChange: body.lastOilChange ? new Date(body.lastOilChange) : null,
        nextOilChange: body.nextOilChange ? new Date(body.nextOilChange) : null,
        lastInspection: body.lastInspection ? new Date(body.lastInspection) : null,
        nextInspection: body.nextInspection ? new Date(body.nextInspection) : null
      },
      include: {
        maintenanceRecords: {
          take: 5,
          orderBy: { datePerformed: 'desc' }
        }
      }
    }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), 10000)
      )
    ]) as any

    // Log audit event (this also logs user activity)
    await logEntityChange(
      'CREATE',
      'TRUCK',
      truck.id,
      user.id,
      undefined,
      truck,
      request
    )

    await syncOneDriveWorkbookAfterChange()

    console.log('Truck created successfully:', truck.id)
    return NextResponse.json({
      success: true,
      data: truck,
      message: 'Truck created successfully'
    })

  } catch (error) {
    console.error('Error creating truck:', error)
    if (error instanceof Error && (error.message === 'No token provided' || error.message === 'Invalid token')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to create truck' },
      { status: 500 }
    )
  }
}
