import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '@/lib/auth'
import QRCode from 'qrcode'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const jobCards = await prisma.jobCard.findMany({
      skip,
      take: limit,
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
      },
      orderBy: { createdAt: 'desc' }
    })

    const total = await prisma.jobCard.count()

    return NextResponse.json({
      success: true,
      data: jobCards,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching job cards:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { maintenanceRecordId, templateId, customFields } = body

    // Check if maintenance record exists
    const maintenanceRecord = await prisma.maintenanceRecord.findUnique({
      where: { id: maintenanceRecordId },
      include: { truck: true, mechanic: true }
    })

    if (!maintenanceRecord) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 })
    }

    // Check if job card already exists for this maintenance record
    const existingJobCard = await prisma.jobCard.findUnique({
      where: { maintenanceRecordId }
    })

    if (existingJobCard) {
      return NextResponse.json({ error: 'Job card already exists for this maintenance record' }, { status: 400 })
    }

    // Generate job card number
    const jobCardNumber = `JC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

    // Generate QR code
    const qrCodeUrl = `${process.env.NEXTAUTH_URL}/job-cards/${jobCardNumber}`
    const qrCode = await QRCode.toDataURL(qrCodeUrl)

    const jobCard = await prisma.jobCard.create({
      data: {
        maintenanceRecordId,
        jobCardNumber,
        qrCode,
        templateId,
        customFields,
        status: 'DRAFT'
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

    return NextResponse.json({ success: true, data: jobCard }, { status: 201 })
  } catch (error) {
    console.error('Error creating job card:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}