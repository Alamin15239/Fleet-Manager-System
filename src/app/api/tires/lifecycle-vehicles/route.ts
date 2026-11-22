import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permission-middleware'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'tire-management', 'read')
  if (auth instanceof NextResponse) return auth
  try {
    const [trucks, trailers] = await Promise.all([
      db.truck.findMany({
        where: { isDeleted: false, status: { not: 'INACTIVE' } },
        select: { id: true, licensePlate: true, make: true, model: true, currentMileage: true, driverName: true },
        orderBy: { licensePlate: 'asc' }
      }),
      db.trailer.findMany({
        where: { isDeleted: false, status: { not: 'INACTIVE' } },
        select: { id: true, number: true, driverName: true },
        orderBy: { number: 'asc' }
      })
    ])
    return NextResponse.json({
      trucks: trucks.map(v => ({ id: v.id, vehicleType: 'truck', label: v.licensePlate, detail: [v.make, v.model].filter(Boolean).join(' '), mileage: v.currentMileage, driverName: v.driverName })),
      trailers: trailers.map(v => ({ id: v.id, vehicleType: 'trailer', label: `Trailer ${v.number}`, detail: '', mileage: null, driverName: v.driverName }))
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    console.error('Tire lifecycle vehicle lookup failed:', error)
    return NextResponse.json({ error: 'Failed to load tire vehicle options' }, { status: 500 })
  }
}
