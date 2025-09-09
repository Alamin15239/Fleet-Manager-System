import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get both truck and trailer maintenance records
    const [truckRecords, trailerRecords] = await Promise.all([
      db.maintenanceRecord.findMany({
        include: {
          truck: true
        },
        orderBy: { datePerformed: 'desc' }
      }),
      db.trailerMaintenanceRecord.findMany({
        include: {
          trailer: true
        },
        orderBy: { datePerformed: 'desc' }
      }).catch(() => []) // Return empty array if trailer table doesn't exist
    ])

    // Combine and format records
    const allRecords = [
      ...truckRecords,
      ...trailerRecords.map(record => ({
        ...record,
        // Add truck field for compatibility
        truck: {
          id: record.trailer?.id || '',
          vin: '',
          make: 'Trailer',
          model: record.trailer?.number || '',
          year: 0,
          licensePlate: `Trailer ${record.trailer?.number || ''}`,
          currentMileage: 0
        }
      }))
    ].sort((a, b) => new Date(b.datePerformed).getTime() - new Date(a.datePerformed).getTime())

    return NextResponse.json({
      success: true,
      records: allRecords,
      pagination: { page: 1, limit: 100, total: allRecords.length, pages: 1 },
      summary: {
        totalCost: allRecords.reduce((sum, r) => sum + (r.totalCost || 0), 0),
        completedCount: allRecords.filter(r => r.status === 'COMPLETED').length,
        inProgressCount: allRecords.filter(r => r.status === 'IN_PROGRESS').length,
        scheduledCount: allRecords.filter(r => r.status === 'SCHEDULED').length
      }
    })
  } catch (error) {
    console.error('Maintenance error:', error)
    return NextResponse.json({
      success: true,
      records: [],
      pagination: { page: 1, limit: 100, total: 0, pages: 0 },
      summary: { totalCost: 0, completedCount: 0, inProgressCount: 0, scheduledCount: 0 }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Check if the selected vehicle is a trailer by checking if it exists in trailer table
    let isTrailer = false
    try {
      const trailer = await db.trailer.findUnique({ where: { id: body.truckId } })
      isTrailer = !!trailer
    } catch (e) {
      // If trailer table doesn't exist, treat as truck
      isTrailer = false
    }
    
    let record
    if (isTrailer) {
      // Create trailer maintenance record
      record = await db.trailerMaintenanceRecord.create({
        data: {
          trailerId: body.truckId,
          serviceType: body.serviceType,
          description: body.description,
          datePerformed: new Date(body.datePerformed),
          partsCost: parseFloat(body.partsCost) || 0,
          laborCost: parseFloat(body.laborCost) || 0,
          totalCost: (parseFloat(body.partsCost) || 0) + (parseFloat(body.laborCost) || 0),
          status: body.status || 'COMPLETED'
        }
      })
    } else {
      // Create truck maintenance record
      record = await db.maintenanceRecord.create({
        data: {
          truckId: body.truckId,
          serviceType: body.serviceType,
          description: body.description,
          datePerformed: new Date(body.datePerformed),
          partsCost: parseFloat(body.partsCost) || 0,
          laborCost: parseFloat(body.laborCost) || 0,
          totalCost: (parseFloat(body.partsCost) || 0) + (parseFloat(body.laborCost) || 0),
          status: body.status || 'COMPLETED'
        }
      })
    }

    return NextResponse.json(record)
  } catch (error) {
    console.error('Maintenance POST error:', error)
    return NextResponse.json({ error: 'Failed to create record' }, { status: 500 })
  }
}