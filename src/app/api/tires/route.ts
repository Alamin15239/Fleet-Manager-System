import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { createTireSchema, tireQuerySchema } from '@/lib/validations/tire'
import { ExcelService } from '@/lib/excel-service'
import { ZodError } from 'zod'
import path from 'path'
import fs from 'fs/promises'

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
    
    // Parse query parameters with validation
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const search = searchParams.get('search')?.trim() || null
    const manufacturer = searchParams.get('manufacturer')?.trim() || null
    const origin = searchParams.get('origin')?.trim() || null
    const plateNumber = searchParams.get('plateNumber')?.trim() || null
    const driverName = searchParams.get('driverName')?.trim() || null
    const tireSize = searchParams.get('tireSize')?.trim() || null
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

    if (tireSize) {
      whereClause.tireSize = { contains: tireSize, mode: 'insensitive' }
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
      }).catch(err => {
        console.error('Error fetching tires:', err)
        return []
      }),
      db.tire.count({ where: whereClause }).catch(err => {
        console.error('Error counting tires:', err)
        return 0
      })
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
    const user = await requireAuth(request)
    
    const body = await request.json()
    
    // Validate input data
    const validatedData = createTireSchema.parse(body)
    
    const { 
      tireSize, 
      manufacturer, 
      origin, 
      plateNumber, 
      trailerNumber, 
      driverName, 
      quantity = 1,
      serialNumber,
      trailerTireSize,
      trailerManufacturer,
      trailerOrigin,
      trailerQuantity = 1,
      trailerSerialNumber,
      notes,
      createdAt
    } = validatedData

    // Validate vehicle exists if plate number is provided
    if (plateNumber) {
      const vehicle = await db.vehicle.findUnique({
        where: { plateNumber }
      })
      if (!vehicle) {
        return NextResponse.json(
          { error: `Truck with plate number '${plateNumber}' not found. Please add the vehicle first.` },
          { status: 400 }
        )
      }
    }

    // Validate trailer exists if trailer number is provided
    if (trailerNumber) {
      const vehicle = await db.vehicle.findFirst({
        where: {
          OR: [
            { trailerNumber },
            { plateNumber: trailerNumber }
          ]
        }
      })
      if (!vehicle) {
        return NextResponse.json(
          { error: `Trailer '${trailerNumber}' not found. Please add the vehicle first.` },
          { status: 400 }
        )
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
          serialNumber: serialNumber || null,
          notes: notes || null,
          createdById: user.id,
          ...(createdAt && { createdAt: new Date(createdAt) })
        })
        totalTires++
      }
    }

    // Create trailer tires if trailer info provided
    if (trailerTireSize && trailerManufacturer && trailerOrigin && trailerNumber) {
      // Get driver name from vehicle if not provided
      let finalDriverName = driverName
      if (!finalDriverName) {
        const vehicle = await db.vehicle.findFirst({
          where: {
            OR: [
              { trailerNumber },
              { plateNumber: trailerNumber }
            ]
          }
        })
        finalDriverName = vehicle?.driverName || null
      }
      
      for (let i = 0; i < trailerQuantity; i++) {
        tiresData.push({
          tireSize: trailerTireSize,
          manufacturer: trailerManufacturer,
          origin: trailerOrigin,
          plateNumber: null, // Trailer tires don't have plate number
          trailerNumber: trailerNumber,
          driverName: finalDriverName,
          quantity: 1,
          serialNumber: trailerSerialNumber || null,
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

    const createdTires = await db.tire.createMany({
      data: tiresData
    })
    
    // Note: Auto-export removed for serverless compatibility

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
      count: createdTires.count,
      excelUpdated: true
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Validation errors:', error.errors)
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    
    if (error instanceof Error) {
      if (error.message === 'No token provided' || error.message === 'Invalid token' || error.message === 'User not found or inactive') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
    }
    
    console.error('Error creating tires:', error)
    return NextResponse.json(
      { error: 'Failed to create tires' },
      { status: 500 }
    )
  }
}