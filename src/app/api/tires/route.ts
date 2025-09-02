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
      trailerTireSize,
      trailerManufacturer,
      trailerOrigin,
      trailerQuantity = 1,
      notes,
      createdAt
    } = body

    // Handle vehicle creation/update if plate number is provided
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
        await db.vehicle.update({
          where: { plateNumber },
          data: {
            ...(trailerNumber && { trailerNumber }),
            ...(driverName && { driverName })
          }
        })
      }
    }

    const tiresData = []
    let totalTires = 0

    // Create truck tires if truck info provided
    if (tireSize && manufacturer && origin && plateNumber) {
      for (let i = 0; i < quantity; i++) {
        tiresData.push({
          tireSize,
          manufacturer,
          origin,
          plateNumber: plateNumber,
          trailerNumber: null, // Truck tires don't have trailer number
          driverName: driverName || null,
          quantity: 1,
          notes: notes || null,
          createdById: user.id,
          ...(createdAt && { createdAt: new Date(createdAt) })
        })
        totalTires++
      }
    }

    // Create trailer tires if trailer info provided
    if (trailerTireSize && trailerManufacturer && trailerOrigin && trailerNumber) {
      for (let i = 0; i < trailerQuantity; i++) {
        tiresData.push({
          tireSize: trailerTireSize,
          manufacturer: trailerManufacturer,
          origin: trailerOrigin,
          plateNumber: null, // Trailer tires don't have plate number
          trailerNumber: trailerNumber,
          driverName: driverName || null,
          quantity: 1,
          notes: notes || null,
          createdById: user.id,
          ...(createdAt && { createdAt: new Date(createdAt) })
        })
        totalTires++
      }
    }

    if (tiresData.length === 0) {
      return NextResponse.json(
        { error: 'No valid tire data provided' },
        { status: 400 }
      )
    }

    console.log('Creating', tiresData.length, 'tire records')
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
      message: `Successfully created ${totalTires} tire(s)`,
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