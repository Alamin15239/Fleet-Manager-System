import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Check if maintenance table exists by trying a simple query
    await db.$queryRaw`SELECT 1 FROM "MaintenanceRecord" LIMIT 1`
    
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
    console.error('Maintenance table not found:', error)
    return NextResponse.json({
      success: true,
      records: [],
      pagination: { page: 1, limit: 100, total: 0, pages: 0 },
      summary: { totalCost: 0, completedCount: 0, inProgressCount: 0, scheduledCount: 0 },
      message: 'Maintenance feature requires database setup'
    })
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Maintenance feature requires database setup. Please run database migrations first.' 
  }, { status: 400 })
}