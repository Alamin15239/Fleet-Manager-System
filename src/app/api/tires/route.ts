import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/tires - Get all tires with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Test database connection first
    try {
      await db.$queryRaw`SELECT 1`
    } catch (dbError) {
      console.error('Database connection failed:', dbError)
      return NextResponse.json({
        tires: [],
        pagination: { page: 1, limit: 20, total: 0, pages: 0 }
      })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const manufacturer = searchParams.get('manufacturer')
    const origin = searchParams.get('origin')
    const plateNumber = searchParams.get('plateNumber')
    const driverName = searchParams.get('driverName')
    const offset = (page - 1) * limit

    let whereClause: any = {}

    if (search) {
      whereClause.OR = [
        { tireSize: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { trailerNumber: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (manufacturer) {
      whereClause.manufacturer = { contains: manufacturer, mode: 'insensitive' }
    }

    if (origin) {
      whereClause.origin = origin
    }

    if (plateNumber) {
      whereClause.plateNumber = { contains: plateNumber, mode: 'insensitive' }
    }

    if (driverName) {
      whereClause.driverName = { contains: driverName, mode: 'insensitive' }
    }

    const [tires, total] = await Promise.all([
      db.tire.findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      db.tire.count({ where: whereClause })
    ])

    return NextResponse.json({
      tires,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching tires:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tires' },
      { status: 500 }
    )
  }
}

// POST /api/tires - Create new tire(s)
export async function POST(request: NextRequest) {
  try {
    console.log('POST /api/tires - Starting request')
    
    const authHeader = request.headers.get('authorization')
    console.log('Auth header:', authHeader ? 'Present' : 'Missing')
    
    const user = await requireAuth(request)
    console.log('User authenticated:', user.id, user.email)
    
    const body = await request.json()
    console.log('Request body:', body)
    
    const { 
      tireSize, 
      manufacturer, 
      origin, 
      plateNumber, 
      trailerNumber, 
      driverName, 
      quantity = 1,
      notes,
      createdAt
    } = body

    if (!tireSize || !manufacturer || !origin) {
      console.log('Validation failed - missing required fields')
      return NextResponse.json(
        { error: 'Tire size, manufacturer, and origin are required' },
        { status: 400 }
      )
    }

    // Only handle vehicle if plate number is provided
    if (plateNumber) {
      let vehicle = await db.vehicle.findUnique({
        where: { plateNumber }
      })

      if (!vehicle) {
        console.log('Creating new vehicle:', plateNumber)
        vehicle = await db.vehicle.create({
          data: {
            plateNumber,
            trailerNumber: trailerNumber || null,
            driverName: driverName || null
          }
        })
      } else {
        console.log('Updating existing vehicle:', plateNumber)
        // Update vehicle with new trailer number and driver name if provided
        await db.vehicle.update({
          where: { plateNumber },
          data: {
            ...(trailerNumber && { trailerNumber }),
            ...(driverName && { driverName })
          }
        })
      }
    }

    // Create tire records
    const tiresData = Array.from({ length: quantity }, (_, index) => ({
      tireSize,
      manufacturer,
      origin,
      plateNumber: plateNumber || null,
      trailerNumber: trailerNumber || null,
      driverName: driverName || null,
      quantity: 1, // Each record represents 1 tire
      notes: notes || null,
      createdById: user.id,
      ...(createdAt && { createdAt: new Date(createdAt) })
    }))

    console.log('Creating', quantity, 'tire records')
    const createdTires = await db.tire.createMany({
      data: tiresData
    })

    console.log('Successfully created', createdTires.count, 'tires')
    
    // Emit real-time update
    if (global.io) {
      global.io.emit('tire-created', {
        count: createdTires.count,
        plateNumber,
        manufacturer,
        tireSize
      })
    }
    
    return NextResponse.json({ 
      message: `Successfully created ${quantity} tire(s)`,
      count: createdTires.count 
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating tires:', error)
    
    if (error instanceof Error) {
      console.log('Error type:', error.message)
      if (error.message === 'No token provided' || error.message === 'Invalid token' || error.message === 'User not found or inactive') {
        return NextResponse.json(
          { error: 'Authentication required', details: error.message },
          { status: 401 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to create tires', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}