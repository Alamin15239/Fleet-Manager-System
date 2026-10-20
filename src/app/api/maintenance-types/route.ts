import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'read')
    const maintenanceTypes = await db.maintenanceType.findMany({ where: { isActive: true }, include: { vehicleTypes: true }, orderBy: { name: 'asc' } })
    return NextResponse.json({ maintenanceTypes })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not load maintenance types' : 'Access denied' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'create')
    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name || name.length > 100) return NextResponse.json({ error: 'Enter a maintenance type name (up to 100 characters).' }, { status: 400 })
    const intervalDays = body.intervalDays === '' || body.intervalDays == null ? null : Number(body.intervalDays)
    const intervalMileage = body.intervalMileage === '' || body.intervalMileage == null ? null : Number(body.intervalMileage)
    const reminderDaysBefore = Number(body.reminderDaysBefore ?? 14)
    if ([intervalDays, intervalMileage, reminderDaysBefore].some(value => value !== null && (!Number.isInteger(value) || value < 0)) || reminderDaysBefore > 365) {
      return NextResponse.json({ error: 'Intervals must be non-negative whole numbers; reminders may be up to 365 days.' }, { status: 400 })
    }
    const typeIds: string[] = Array.isArray(body.vehicleTypeIds) ? Array.from(new Set<string>(body.vehicleTypeIds.map((id: unknown) => String(id)))) : []
    const maintenanceType = await db.maintenanceType.create({ data: {
      name, description: String(body.description || '').trim() || null, intervalDays, intervalMileage, reminderDaysBefore,
      vehicleTypes: typeIds.length ? { connect: typeIds.map(id => ({ id })) } : undefined,
    }, include: { vehicleTypes: true } })
    return NextResponse.json({ maintenanceType }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not save maintenance type; the name may already exist.' : 'Access denied' }, { status })
  }
}
