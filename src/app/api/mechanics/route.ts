import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireManager } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Test database connection first
    try {
      await db.$queryRaw`SELECT 1`
    } catch (dbError) {
      console.error('Database connection failed:', dbError)
      return NextResponse.json([])
    }

    requireManager(request)
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const includeCount = searchParams.get('includeCount') === 'true'

    let whereClause: any = {
      isDeleted: false // Only show non-deleted mechanics
    }
    
    if (!includeInactive) {
      whereClause.isActive = true
    }

    let selectFields: any = {
      id: true,
      name: true,
      email: true,
      phone: true,
      specialty: true,
      isActive: true
    }

    if (includeCount) {
      const mechanics = await db.mechanic.findMany({
        where: whereClause,
        select: {
          ...selectFields,
          _count: {
            select: {
              maintenanceRecords: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      })

      const mechanicsWithCount = mechanics.map(mechanic => ({
        ...mechanic,
        maintenanceCount: mechanic._count.maintenanceRecords
      }))

      return NextResponse.json(mechanicsWithCount)
    }

    const mechanics = await db.mechanic.findMany({
      where: whereClause,
      select: selectFields,
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(mechanics)
  } catch (error) {
    console.error('Error fetching mechanics:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to fetch mechanics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    requireManager(request)
    const body = await request.json()
    const { name, email, phone, specialty, isActive } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Create mechanic
    const mechanic = await db.mechanic.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        specialty: specialty || null,
        isActive: isActive !== undefined ? isActive : true
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        specialty: true,
        isActive: true
      }
    })

    return NextResponse.json({
      message: 'Mechanic created successfully',
      data: mechanic
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating mechanic:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to create mechanic' },
      { status: 500 }
    )
  }
}