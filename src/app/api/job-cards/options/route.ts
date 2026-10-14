import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const [trucks, trailers] = await Promise.all([
      db.truck.findMany({ where: { isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true, make: true, model: true, year: true, licensePlate: true, driverName: true, currentMileage: true }, orderBy: { licensePlate: 'asc' } }),
      db.trailer.findMany({ where: { isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true, number: true, driverName: true }, orderBy: { number: 'asc' } })
    ])
    return NextResponse.json({ trucks, trailers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch vehicles'
    return NextResponse.json({ error: message }, { status: message.includes('token') ? 401 : 500 })
  }
}
