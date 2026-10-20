import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRolePermission(request, 'trucks', 'update')
    const { id } = await params
    const body = await request.json()
    const vehicleNumber = String(body.vehicleNumber || '').trim()
    if (!vehicleNumber || !body.vehicleTypeId) return NextResponse.json({ error: 'Vehicle number and type are required.' }, { status: 400 })
    const year = body.year === '' || body.year == null ? null : Number(body.year)
    const mileage = body.currentMileage === '' || body.currentMileage == null ? null : Number(body.currentMileage)
    const hours = body.engineHours === '' || body.engineHours == null ? null : Number(body.engineHours)
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 2)) return NextResponse.json({ error: 'Enter a valid model year.' }, { status: 400 })
    if ([mileage, hours].some(value => value !== null && (!Number.isInteger(value) || value < 0))) return NextResponse.json({ error: 'Mileage and engine hours must be non-negative whole numbers.' }, { status: 400 })
    const fleetVehicle = await db.fleetVehicle.update({ where: { id }, data: {
      vehicleNumber, vehicleTypeId: body.vehicleTypeId,
      vin: String(body.vin || '').trim() || null,
      registrationNo: String(body.registrationNo || '').trim() || null,
      make: String(body.make || '').trim() || null,
      model: String(body.model || '').trim() || null,
      year, currentMileage: mileage, engineHours: hours,
      driverName: String(body.driverName || '').trim() || null,
      status: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(body.status) ? body.status : 'ACTIVE',
      notes: String(body.notes || '').trim() || null,
    } })
    return NextResponse.json({ fleetVehicle })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not update vehicle. Check that its number and VIN are unique.' : 'Access denied' }, { status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRolePermission(request, 'trucks', 'delete')
    const { id } = await params
    await db.fleetVehicle.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not delete vehicle' : 'Access denied' }, { status })
  }
}
