import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRolePermission(request, 'maintenance', 'update')
    const { id } = await params
    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'Maintenance type name is required.' }, { status: 400 })
    const intervalDays = body.intervalDays === '' || body.intervalDays == null ? null : Number(body.intervalDays)
    const intervalMileage = body.intervalMileage === '' || body.intervalMileage == null ? null : Number(body.intervalMileage)
    const reminderDaysBefore = Number(body.reminderDaysBefore ?? 14)
    if ([intervalDays, intervalMileage, reminderDaysBefore].some(value => value !== null && (!Number.isInteger(value) || value < 0)) || reminderDaysBefore > 365) return NextResponse.json({ error: 'Check the service intervals and reminder days.' }, { status: 400 })
    const vehicleTypeIds: string[] = Array.isArray(body.vehicleTypeIds) ? Array.from(new Set<string>(body.vehicleTypeIds.map((id: unknown) => String(id)))) : []
    const maintenanceType = await db.maintenanceType.update({ where: { id }, data: {
      name, description: String(body.description || '').trim() || null, intervalDays, intervalMileage, reminderDaysBefore,
      vehicleTypes: { set: vehicleTypeIds.map(id => ({ id })) },
    }, include: { vehicleTypes: true } })
    return NextResponse.json({ maintenanceType })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not update maintenance type; confirm the name is unique.' : 'Access denied' }, { status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRolePermission(request, 'maintenance', 'delete')
    const { id } = await params
    await db.maintenanceType.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not archive maintenance type' : 'Access denied' }, { status })
  }
}
