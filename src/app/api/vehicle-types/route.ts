import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

const defaults = ['Truck', 'Trailer', 'Forklift', 'Saloon car', 'Bus', 'Pickup', 'Other']

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trucks', 'read')
    await db.vehicleType.createMany({ data: defaults.map(name => ({ name })), skipDuplicates: true })
    const vehicleTypes = await db.vehicleType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    return NextResponse.json({ vehicleTypes })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not load vehicle types' : 'Access denied' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trucks', 'create')
    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name || name.length > 80) return NextResponse.json({ error: 'Enter a vehicle type name (up to 80 characters).' }, { status: 400 })
    const vehicleType = await db.vehicleType.create({ data: { name, description: String(body.description || '').trim() || null } })
    return NextResponse.json({ vehicleType }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not create vehicle type; the name may already exist.' : 'Access denied' }, { status })
  }
}
