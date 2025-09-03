import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(request)
    const body = await request.json()

    // Check if trailer number is being changed and already exists
    if (body.number) {
      const existingTrailer = await db.trailer.findFirst({
        where: { 
          number: body.number,
          NOT: { id: id },
          isDeleted: false
        }
      })

      if (existingTrailer) {
        return NextResponse.json(
          { error: 'Trailer with this number already exists' },
          { status: 400 }
        )
      }
    }

    const updatedTrailer = await db.trailer.update({
      where: { id: id },
      data: {
        ...(body.number && { number: body.number }),
        ...(body.status && { status: body.status }),
        ...(body.driverName !== undefined && { driverName: body.driverName })
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedTrailer,
      message: 'Trailer updated successfully'
    })
  } catch (error) {
    console.error('Error updating trailer:', error)
    return NextResponse.json(
      { error: 'Failed to update trailer' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireAuth(request)

    await db.trailer.update({
      where: { id: id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Trailer deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting trailer:', error)
    return NextResponse.json(
      { error: 'Failed to delete trailer' },
      { status: 500 }
    )
  }
}