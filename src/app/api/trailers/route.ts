import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trailers', 'read')
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')

    const trailers = await db.trailer.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        number: true,
        status: true,
        driverName: true,
        healthScore: true,
        riskLevel: true,
        lastInspection: true,
        nextInspection: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            trailerMaintenanceRecords: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: trailers
    })
  } catch (error) {
    console.error('Error fetching trailers:', error)
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Access denied' : 'Failed to fetch trailers' },
      { status: unauthorized ? 401 : forbidden ? 403 : 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trailers', 'create')
    const body = await request.json()

    // Check if trailer number already exists
    const existingTrailer = await db.trailer.findFirst({
      where: { 
        number: body.number,
        isDeleted: false
      }
    })

    if (existingTrailer) {
      return NextResponse.json(
        { error: 'Trailer with this number already exists' },
        { status: 400 }
      )
    }

    const trailer = await db.trailer.create({
      data: {
        number: body.number,
        status: body.status || 'ACTIVE',
        driverName: body.driverName || null,
        healthScore: body.healthScore ? parseFloat(body.healthScore) : null,
        riskLevel: body.riskLevel || 'LOW'
      }
    })

    await syncOneDriveWorkbookAfterChange()

    return NextResponse.json({
      success: true,
      data: trailer,
      message: 'Trailer created successfully'
    })
  } catch (error) {
    console.error('Error creating trailer:', error)
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Failed to create trailer' },
      { status: 500 }
    )
  }
}
