import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireManager } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
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
        maintenanceCount: (mechanic._count as any).maintenanceRecords
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
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : 'Failed to fetch mechanics' },
      { status: unauthorized ? 401 : 503 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireManager(request)
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
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Manager access required' : 'Failed to create mechanic' },
      { status: unauthorized ? 401 : forbidden ? 403 : 500 }
    )
  }
}
