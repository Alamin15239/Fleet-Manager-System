import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobCard = await prisma.jobCard.findUnique({
      where: { id: params.id },
      include: {
        maintenanceRecord: {
          include: {
            truck: true,
            mechanic: true
          }
        },
        template: true,
        printLogs: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          },
          orderBy: { printedAt: 'desc' }
        }
      }
    })

    if (!jobCard) {
      return NextResponse.json({ error: 'Job card not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: jobCard })
  } catch (error) {
    console.error('Error fetching job card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { customerSignature, mechanicSignature, supervisorSignature, status, customFields } = body

    const jobCard = await prisma.jobCard.update({
      where: { id: params.id },
      data: {
        customerSignature,
        mechanicSignature,
        supervisorSignature,
        status,
        customFields
      },
      include: {
        maintenanceRecord: {
          include: {
            truck: true,
            mechanic: true
          }
        },
        template: true
      }
    })

    return NextResponse.json({ success: true, data: jobCard })
  } catch (error) {
    console.error('Error updating job card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.jobCard.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true, message: 'Job card deleted successfully' })
  } catch (error) {
    console.error('Error deleting job card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}