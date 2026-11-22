import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permission-middleware'
import { ensureTireLifecycleTables, recordTireLifecycleEvent } from '@/lib/tire-lifecycle'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'tire-management', 'create')
    if (authResult instanceof NextResponse) return authResult
    const user = authResult.user
    const body = await request.json()
    const tireId = typeof body.tireId === 'string' ? body.tireId.trim() : ''
    const eventType = typeof body.eventType === 'string' ? body.eventType.trim().toUpperCase() : ''
    if (!tireId || !eventType) return NextResponse.json({ error: 'tireId and eventType are required' }, { status: 400 })

    const vehicleType = body.vehicleType === 'trailer' ? 'trailer' : body.vehicleType === 'truck' ? 'truck' : null
    const vehicleId = typeof body.vehicleId === 'string' ? body.vehicleId.trim() : ''
    const vehicle = vehicleType && vehicleId ? { vehicleType, vehicleId } as const : null
    const eventAt = body.eventAt ? new Date(body.eventAt) : new Date()
    const odometerKm = body.odometerKm == null ? null : Number(body.odometerKm)
    const cost = body.cost == null ? null : Number(body.cost)
    if (!Number.isFinite(eventAt.getTime())) return NextResponse.json({ error: 'Invalid event date' }, { status: 400 })
    if (odometerKm !== null && (!Number.isInteger(odometerKm) || odometerKm < 0)) return NextResponse.json({ error: 'Odometer must be a non-negative whole number' }, { status: 400 })
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return NextResponse.json({ error: 'Cost must be a non-negative number' }, { status: 400 })

    const result = await db.$transaction(async tx => recordTireLifecycleEvent(tx, {
      tireId, eventType, eventAt, vehicle, position: typeof body.position === 'string' ? body.position.trim() : null,
      driverName: typeof body.driverName === 'string' ? body.driverName.trim() : null,
      odometerKm, reason: typeof body.reason === 'string' ? body.reason.trim() : null,
      damageType: typeof body.damageType === 'string' ? body.damageType.trim() : null,
      repairable: typeof body.repairable === 'boolean' ? body.repairable : null,
      cost, notes: typeof body.notes === 'string' ? body.notes.trim() : null, userId: user.id
    }))
    return NextResponse.json({ success: true, ...result }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record tire event'
    const status = message.includes('not found') ? 404
      : message.includes('Wheel position already occupied') || message.includes('already received') || message.includes('already in this wheel position') ? 409
      : message.includes('Select ') || message.includes('already installed') || message.includes('Only ') || message.includes('before disposal') || message.includes('before repair') || message.includes('received again') || message.includes('Unsupported') || message.includes('Use Change wheel position') || message.includes('must stay on the same vehicle') ? 400
      : message.includes('token') ? 401 : message === 'Insufficient permissions' ? 403 : 500
    console.error('Tire lifecycle event error:', error)
    return NextResponse.json({ error: status === 500 ? 'Failed to record tire event' : message }, { status })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermission(request, 'tire-management', 'read')
    if (authResult instanceof NextResponse) return authResult
    const { searchParams } = new URL(request.url)
    const tireId = searchParams.get('tireId')
    const jobCardId = searchParams.get('jobCardId')
    await db.$transaction(async tx => ensureTireLifecycleTables(tx))
    const rows = await db.$queryRawUnsafe(
      `SELECT e.*, t."tireSize",t."manufacturer",t."serialNumber",t."internalCode",
         COALESCE(ft."licensePlate",ftr."number") AS "fromVehicleLabel",
         COALESCE(tt."licensePlate",ttr."number") AS "toVehicleLabel"
       FROM "tire_lifecycle_events" e JOIN "tires" t ON t."id"=e."tireId"
       LEFT JOIN "trucks" ft ON ft."id"=e."fromTruckId"
       LEFT JOIN "trailers" ftr ON ftr."id"=e."fromTrailerId"
       LEFT JOIN "trucks" tt ON tt."id"=e."toTruckId"
       LEFT JOIN "trailers" ttr ON ttr."id"=e."toTrailerId"
       WHERE ($1::text IS NULL OR e."tireId"=$1) AND ($2::text IS NULL OR e."jobCardId"=$2)
       ORDER BY e."eventAt" DESC LIMIT 500`, tireId, jobCardId
    )
    return NextResponse.json({ events: rows })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tire history'
    return NextResponse.json({ error: message }, { status: message.includes('token') ? 401 : message === 'Insufficient permissions' ? 403 : 500 })
  }
}
