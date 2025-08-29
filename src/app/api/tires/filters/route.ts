import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tires/filters - Get unique filter options efficiently
export async function GET() {
  try {
    // Use aggregation to get unique values efficiently
    const [manufacturers, origins, plates, drivers] = await Promise.all([
      db.tire.findMany({
        select: { manufacturer: true },
        distinct: ['manufacturer'],
        orderBy: { manufacturer: 'asc' }
      }),
      db.tire.findMany({
        select: { origin: true },
        distinct: ['origin'],
        orderBy: { origin: 'asc' }
      }),
      db.tire.findMany({
        select: { plateNumber: true },
        distinct: ['plateNumber'],
        orderBy: { plateNumber: 'asc' }
      }),
      db.tire.findMany({
        select: { driverName: true },
        distinct: ['driverName'],
        where: { driverName: { not: null } },
        orderBy: { driverName: 'asc' }
      })
    ])

    return NextResponse.json({
      manufacturers: manufacturers.map(m => m.manufacturer),
      origins: origins.map(o => o.origin),
      plates: plates.map(p => p.plateNumber),
      drivers: drivers.map(d => d.driverName).filter(Boolean)
    })
  } catch (error) {
    console.error('Error fetching filter options:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filter options' },
      { status: 500 }
    )
  }
}