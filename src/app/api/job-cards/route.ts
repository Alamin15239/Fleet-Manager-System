import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateQRCode } from '@/lib/qrCode'

// GET all job cards
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const mechanicId = searchParams.get('mechanicId')
    const vehicleType = searchParams.get('vehicleType')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const skip = (page - 1) * limit

    const whereClause: any = {}

    if (search) {
      whereClause.OR = [
        { jobCardNo: { contains: search, mode: 'insensitive' } },
        { vehicleName: { contains: search, mode: 'insensitive' } },
        { vehicleIdentifier: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } },
        { mechanicName: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (mechanicId) {
      whereClause.mechanicId = mechanicId
    }

    if (vehicleType && vehicleType !== 'all') {
      whereClause.vehicleType = vehicleType
    }

    if (dateFrom) {
      whereClause.createdAt = {
        gte: new Date(dateFrom)
      }
    }

    if (dateTo) {
      whereClause.createdAt = {
        ...(whereClause.createdAt || {}),
        lte: new Date(dateTo)
      }
    }

    const [jobCards, totalCount] = await Promise.all([
      db.jobCard.findMany({
        where: whereClause,
        include: {
          maintenanceRecord: {
            include: {
              truck: {
                select: {
                  id: true,
                  vin: true,
                  make: true,
                  model: true,
                  year: true,
                  licensePlate: true
                }
              }
            }
          },
          trailerMaintenanceRecord: {
            include: {
              trailer: {
                select: {
                  id: true,
                  number: true,
                  status: true
                }
              }
            }
          },
          mechanic: {
            select: {
              id: true,
              name: true,
              specialty: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.jobCard.count({ where: whereClause })
    ])

    return NextResponse.json({
      success: true,
      data: jobCards,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching job cards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job cards' },
      { status: 500 }
    )
  }
}

// POST create new job card
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Generate unique job card number
    const jobCardNo = `JC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    
    // Generate QR token
    const qrToken = `${jobCardNo}-${Math.random().toString(36).substr(2, 8)}`

    // Validate required fields
    const requiredFields = ['vehicleType', 'vehicleId', 'vehicleName', 'vehicleIdentifier']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    const jobCard = await db.jobCard.create({
      data: {
        jobCardNo,
        maintenanceRecordId: body.maintenanceRecordId || null,
        trailerMaintenanceRecordId: body.trailerMaintenanceRecordId || null,
        status: body.status || 'DRAFT',
        vehicleType: body.vehicleType,
        vehicleId: body.vehicleId,
        vehicleName: body.vehicleName,
        vehicleIdentifier: body.vehicleIdentifier,
        driverName: body.driverName,
        mechanicId: body.mechanicId || null,
        mechanicName: body.mechanicName,
        reportedIssues: body.reportedIssues,
        requestedWork: body.requestedWork,
        tasks: body.tasks || [],
        parts: body.parts || [],
        totalCost: body.totalCost || 0,
        odometer: body.odometer,
        engineHours: body.engineHours,
        qrToken,
        signatures: body.signatures || {},
        createdById: body.createdById
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
      message: 'Job card created successfully'
    })

  } catch (error) {
    console.error('Error creating job card:', error)
    return NextResponse.json(
      { error: 'Failed to create job card' },
      { status: 500 }
    )
  }
}