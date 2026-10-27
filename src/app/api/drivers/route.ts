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
    const driverRecords = await db.driver.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    })

    // Query driver cards by foreign key separately so legacy documentType
    // casing or nested relation filters cannot hide a saved card.
    const driverIds = driverRecords.map(driver => driver.id)
    const documents = driverIds.length
      ? await db.vehicleDocument.findMany({
          where: {
            driverId: { in: driverIds },
            documentType: { equals: 'Driver card', mode: 'insensitive' },
          },
          select: { id: true, driverId: true, documentType: true, fileName: true, validFrom: true, validUntil: true, reminderStartDate: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        })
      : []
    const latestCardByDriver = new Map<string, typeof documents[number]>()
    for (const document of documents) {
      if (document.driverId && !latestCardByDriver.has(document.driverId)) {
        latestCardByDriver.set(document.driverId, document)
      }
    }
    const drivers = driverRecords.map(driver => {
      const card = latestCardByDriver.get(driver.id)
      return { ...driver, vehicleDocuments: card ? [{
        id: card.id,
        documentType: card.documentType,
        fileName: card.fileName,
        validFrom: card.validFrom,
        validUntil: card.validUntil,
        reminderStartDate: card.reminderStartDate,
        updatedAt: card.updatedAt,
      }] : [] }
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
