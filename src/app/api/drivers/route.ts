import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

function normalizeDriverName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const unauthorized = ['No token provided', 'Invalid token'].includes(message)
  const forbidden = message === 'Insufficient permissions'
  return NextResponse.json(
    { error: unauthorized ? 'Authentication required' : forbidden ? 'Access denied' : 'Could not load drivers.' },
    { status: unauthorized ? 401 : forbidden ? 403 : 500 },
  )
}

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trucks', 'read')
    const drivers = await db.driver.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleDocuments: {
          where: { documentType: { equals: 'Driver card', mode: 'insensitive' } },
          select: { id: true, fileName: true, validFrom: true, validUntil: true, reminderStartDate: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ drivers })
  } catch (error) {
    return authError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trucks', 'create')
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
    if (!name) return NextResponse.json({ error: 'Driver name is required.' }, { status: 400 })
    if (name.length > 120) return NextResponse.json({ error: 'Driver name must be 120 characters or fewer.' }, { status: 400 })

    const driver = await db.driver.upsert({
      where: { normalizedName: normalizeDriverName(name) },
      create: { name, normalizedName: normalizeDriverName(name), phone: typeof body.phone === 'string' ? body.phone.trim() || null : null },
      update: { isActive: true, isDeleted: false },
      select: { id: true, name: true, phone: true },
    })
    return NextResponse.json({ driver }, { status: 201 })
  } catch (error) {
    return authError(error)
  }
}
