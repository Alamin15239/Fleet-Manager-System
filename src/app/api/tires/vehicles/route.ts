import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permission-middleware'

/** Return only the vehicle identifiers needed by tire forms and filters. */
export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'tire-management', 'read')
  if (authResult instanceof NextResponse) return authResult

  try {
    const vehicles = await db.vehicle.findMany({
      where: { isActive: true },
      select: { plateNumber: true, trailerNumber: true, driverName: true },
      orderBy: { plateNumber: 'asc' }
    })

    return NextResponse.json({ vehicles }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' }
    })
  } catch (error) {
    console.error('Error fetching tire vehicle options:', error)
    return NextResponse.json({ error: 'Failed to fetch tire vehicle options' }, { status: 500 })
  }
}
