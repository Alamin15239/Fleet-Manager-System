import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const records = await db.maintenanceRecord.findMany({
      include: {
        truck: true
      },
      orderBy: { datePerformed: 'desc' }
    })

    return NextResponse.json({
      success: true,
      records,
      pagination: { page: 1, limit: 100, total: records.length, pages: 1 },
      summary: {
        totalCost: records.reduce((sum, r) => sum + (r.totalCost || 0), 0),
        completedCount: records.filter(r => r.status === 'COMPLETED').length,
        inProgressCount: records.filter(r => r.status === 'IN_PROGRESS').length,
        scheduledCount: records.filter(r => r.status === 'SCHEDULED').length
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

    const record = await db.maintenanceRecord.create({
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

    return NextResponse.json(record)
  } catch (error) {
    console.error('Maintenance POST error:', error)
    return NextResponse.json({ error: 'Failed to create record' }, { status: 500 })
  }
}