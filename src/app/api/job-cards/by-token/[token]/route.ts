import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET job card by QR token
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const jobCard = await db.jobCard.findUnique({
      where: { qrToken: params.token },
      include: {
        maintenanceRecord: {
          include: {
            truck: true
          }
        },
        trailerMaintenanceRecord: {
          include: {
            trailer: true
          }
        },
        mechanic: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!jobCard) {
      return NextResponse.json(
        { error: 'Job card not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: jobCard
    })

  } catch (error) {
    console.error('Error fetching job card by token:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job card' },
      { status: 500 }
    )
  }
}