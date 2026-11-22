import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permission-middleware'
import { ensureTireLifecycleTables } from '@/lib/tire-lifecycle'

// GET /api/tires/filters - Get unique filter options efficiently
export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'tire-management', 'read')
  if (authResult instanceof NextResponse) return authResult

  try {
    await db.$transaction(async tx => ensureTireLifecycleTables(tx))
    // Use aggregation to get unique values efficiently
    const [manufacturers, origins, plates, trailers, drivers] = await Promise.all([
      db.tire.findMany({
        where: { deletedAt: null },
        select: { manufacturer: true },
        distinct: ['manufacturer'],
        orderBy: { manufacturer: 'asc' }
      }),
      db.tire.findMany({
        where: { deletedAt: null },
        select: { origin: true },
        distinct: ['origin'],
        orderBy: { origin: 'asc' }
      }),
      db.tire.findMany({
        where: { deletedAt: null },
        select: { plateNumber: true },
        distinct: ['plateNumber'],
        orderBy: { plateNumber: 'asc' }
      }),
      db.tire.findMany({
        select: { trailerNumber: true },
        distinct: ['trailerNumber'],
        where: { deletedAt: null, trailerNumber: { not: null } },
        orderBy: { trailerNumber: 'asc' }
      }),
      db.tire.findMany({
        select: { driverName: true },
        distinct: ['driverName'],
        where: { deletedAt: null, driverName: { not: null } },
        orderBy: { driverName: 'asc' }
      })
    ])

    return NextResponse.json({
      manufacturers: manufacturers.map(m => m.manufacturer).filter(value => value.trim().length > 0),
      origins: origins.map(o => o.origin).filter(value => value.trim().length > 0),
      plates: plates.map(p => p.plateNumber).filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      trailers: trailers.map(t => t.trailerNumber).filter(Boolean),
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
