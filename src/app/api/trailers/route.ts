import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
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
    return NextResponse.json(
      { error: 'Failed to fetch trailers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
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

    return NextResponse.json({
      success: true,
      data: trailer,
      message: 'Trailer created successfully'
    })
  } catch (error) {
    console.error('Error creating trailer:', error)
    return NextResponse.json(
      { error: 'Failed to create trailer' },
      { status: 500 }
    )
  }
}