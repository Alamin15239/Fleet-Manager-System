import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

const allowedFiles = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const expiryDocumentTypes = ['Fire extinguisher', 'Operation card', 'Istimara', 'Insurance', 'Driver card', 'Fahas'] as const
const protectionCardType = 'Protection Card'
const maxFileBytes = 4 * 1024 * 1024

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
}

function safeError(status: number, fallback: string) {
  return NextResponse.json({ error: status === 500 ? fallback : 'Access denied.' }, { status })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('view') === 'expiry') {
      await requireRolePermission(request, 'trucks', 'read')
      const trucks = await db.truck.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          licensePlate: true,
          make: true,
          model: true,
          year: true,
          driverName: true,
          vehicleDocuments: {
            where: { documentType: { in: [...expiryDocumentTypes] } },
            select: { id: true, title: true, documentType: true, fileName: true, validFrom: true, validUntil: true, reminderStartDate: true, createdAt: true },
          },
        },
        orderBy: { licensePlate: 'asc' },
      })
      return NextResponse.json({ trucks, documentTypes: expiryDocumentTypes })
    }

    const sourceType = searchParams.get('sourceType')
    const sourceId = searchParams.get('sourceId')
    if (!sourceId || !['TRUCK', 'TRAILER'].includes(sourceType || '')) {
      return NextResponse.json({ error: 'Choose a valid truck or trailer.' }, { status: 400 })
    }
    await requireRolePermission(request, sourceType === 'TRUCK' ? 'trucks' : 'trailers', 'read')
    const documents = await db.vehicleDocument.findMany({
      where: {
        [sourceType === 'TRUCK' ? 'truckId' : 'trailerId']: sourceId,
        documentType: protectionCardType,
      },
      select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ documents })
  } catch (error) {
    return safeError(statusFor(error), 'Could not load vehicle documents.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const sourceType = String(form.get('sourceType') || '')
    const sourceId = String(form.get('sourceId') || '').trim()
    const documentType = String(form.get('documentType') || '').trim()
    const isExpiryDocument = (expiryDocumentTypes as readonly string[]).includes(documentType)
    const isProtectionCard = documentType === protectionCardType

    if (!sourceId || !['TRUCK', 'TRAILER'].includes(sourceType)) {
      return NextResponse.json({ error: 'Select a valid truck or trailer.' }, { status: 400 })
    }
    if (!isExpiryDocument && !isProtectionCard) {
      return NextResponse.json({ error: 'Choose a supported document type.' }, { status: 400 })
    }
    if (isExpiryDocument && sourceType !== 'TRUCK') {
      return NextResponse.json({ error: 'Expiry tracking documents are attached to trucks.' }, { status: 400 })
    }
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a document file.' }, { status: 400 })
    if (file.size > maxFileBytes) return NextResponse.json({ error: 'Vehicle documents must be 4 MB or smaller.' }, { status: 400 })
    if (!allowedFiles.has(file.type)) return NextResponse.json({ error: 'Upload a PDF, JPG, PNG, or WEBP file.' }, { status: 400 })

    if (sourceType === 'TRUCK' && !await db.truck.findFirst({ where: { id: sourceId, isDeleted: false }, select: { id: true } })) {
      return NextResponse.json({ error: 'Active truck not found.' }, { status: 404 })
    }
    if (sourceType === 'TRAILER' && !await db.trailer.findFirst({ where: { id: sourceId, isDeleted: false }, select: { id: true } })) {
      return NextResponse.json({ error: 'Active trailer not found.' }, { status: 404 })
    }

    const validFromText = String(form.get('validFrom') || '').trim()
    const validUntilText = String(form.get('validUntil') || '').trim()
    const reminderText = String(form.get('reminderStartDate') || '').trim()
    if (isExpiryDocument && (!validUntilText || !reminderText)) {
      return NextResponse.json({ error: 'Expiry date and reminder start date are required.' }, { status: 400 })
    }
    const validFrom = validFromText ? new Date(validFromText) : null
    const validUntil = validUntilText ? new Date(validUntilText) : null
    const reminderStartDate = reminderText ? new Date(reminderText) : null
    if ([validFrom, validUntil, reminderStartDate].some(date => date && Number.isNaN(date.getTime()))) {
      return NextResponse.json({ error: 'Enter valid document dates.' }, { status: 400 })
    }
    if (validFrom && validUntil && validUntil < validFrom) {
      return NextResponse.json({ error: 'Expiry date must be after the valid-from date.' }, { status: 400 })
    }
    if (reminderStartDate && validUntil && reminderStartDate > validUntil) {
      return NextResponse.json({ error: 'Reminder must start on or before the expiry date.' }, { status: 400 })
    }

    const uniqueWhere = sourceType === 'TRUCK'
      ? { truckId_documentType: { truckId: sourceId, documentType } }
      : { trailerId_documentType: { trailerId: sourceId, documentType } }
    const existingDocument = await db.vehicleDocument.findUnique({ where: uniqueWhere as any, select: { id: true } })
    await requireRolePermission(request, sourceType === 'TRUCK' ? 'trucks' : 'trailers', existingDocument ? 'update' : 'create')
    const fileData = Buffer.from(await file.arrayBuffer())
    const data = {
      truckId: sourceType === 'TRUCK' ? sourceId : null,
      trailerId: sourceType === 'TRAILER' ? sourceId : null,
      vehicleId: null,
      title: String(form.get('title') || file.name).trim().slice(0, 120) || file.name,
      documentType,
      fileName: file.name.replace(/[\r\n"\\/]/g, '_').slice(0, 180),
      mimeType: file.type,
      fileSize: file.size,
      fileData,
      validFrom: isExpiryDocument ? validFrom : null,
      validUntil: isExpiryDocument ? validUntil : null,
      reminderStartDate: isExpiryDocument ? reminderStartDate : null,
      notes: String(form.get('notes') || '').trim().slice(0, 2000) || null,
    }
    const document = await db.vehicleDocument.upsert({
      where: uniqueWhere as any,
      create: data,
      update: { ...data, truckId: undefined, trailerId: undefined, vehicleId: undefined },
      select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, validFrom: true, validUntil: true, reminderStartDate: true, notes: true, createdAt: true },
    })
    return NextResponse.json({ document })
  } catch (error) {
    const status = statusFor(error)
    return safeError(status, 'Could not save the vehicle document.')
  }
}
