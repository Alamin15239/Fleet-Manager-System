import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET single job card
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobCard = await db.jobCard.findUnique({
      where: { id: params.id },
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
    console.error('Error fetching job card:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job card' },
      { status: 500 }
    )
  }
}

// PUT update job card
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    const jobCard = await db.jobCard.update({
      where: { id: params.id },
      data: {
        status: body.status,
        reportedIssues: body.reportedIssues,
        requestedWork: body.requestedWork,
        tasks: body.tasks,
        parts: body.parts,
        totalCost: body.totalCost,
        odometer: body.odometer,
        engineHours: body.engineHours,
        signatures: body.signatures,
        mechanicId: body.mechanicId,
        mechanicName: body.mechanicName
      },
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

    return NextResponse.json({
      success: true,
      data: jobCard,
      message: 'Job card updated successfully'
    })

  } catch (error) {
    console.error('Error updating job card:', error)
    return NextResponse.json(
      { error: 'Failed to update job card' },
      { status: 500 }
    )
  }
}

// DELETE job card
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await db.jobCard.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Job card deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting job card:', error)
    return NextResponse.json(
      { error: 'Failed to delete job card' },
      { status: 500 }
    )
  }
}