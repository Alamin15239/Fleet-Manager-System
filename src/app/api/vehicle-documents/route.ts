import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

const allowedFiles = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const expiryDocumentTypes = ['Fire extinguisher', 'Operation card', 'Istimara', 'Insurance', 'Fahas'] as const
const driverCardType = 'Driver card'
const protectionCardType = 'Protection Card'
const maxFileBytes = 4 * 1024 * 1024

function statusFor(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
}

function safeError(status: number, fallback: string) {
  return NextResponse.json({ error: status === 500 ? fallback : 'Access denied.' }, { status })
}

function parseDateInput(value: string) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

function oneYearBefore(date: Date) {
  const year = date.getUTCFullYear() - 1
  const month = date.getUTCMonth()
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
  return new Date(Date.UTC(year, month, day))
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
    const isDriverCard = documentType === driverCardType

    if (!sourceId || !['TRUCK', 'TRAILER', 'DRIVER'].includes(sourceType)) {
      return NextResponse.json({ error: 'Select a valid truck, trailer, or driver.' }, { status: 400 })
    }
    if (!isExpiryDocument && !isProtectionCard && !isDriverCard) {
      return NextResponse.json({ error: 'Choose a supported document type.' }, { status: 400 })
    }
    if ((isExpiryDocument && sourceType !== 'TRUCK') || (isDriverCard && sourceType !== 'DRIVER') || (sourceType === 'DRIVER' && !isDriverCard)) {
      return NextResponse.json({ error: 'Choose the correct owner for this document type.' }, { status: 400 })
    }
    if (isProtectionCard && sourceType === 'DRIVER') {
      return NextResponse.json({ error: 'Protection Cards are attached to trucks or trailers.' }, { status: 400 })
    }
    const submittedFile = form.get('file')
    const file = submittedFile instanceof File && submittedFile.size > 0 ? submittedFile : null
    if (file && file.size > maxFileBytes) return NextResponse.json({ error: 'Vehicle documents must be 4 MB or smaller.' }, { status: 400 })
    if (file && !allowedFiles.has(file.type)) return NextResponse.json({ error: 'Upload a PDF, JPG, PNG, or WEBP file.' }, { status: 400 })

    if (sourceType === 'TRUCK' && !await db.truck.findFirst({ where: { id: sourceId, isDeleted: false }, select: { id: true } })) {
      return NextResponse.json({ error: 'Active truck not found.' }, { status: 404 })
    }
    if (sourceType === 'TRAILER' && !await db.trailer.findFirst({ where: { id: sourceId, isDeleted: false }, select: { id: true } })) {
      return NextResponse.json({ error: 'Active trailer not found.' }, { status: 404 })
    }
    if (sourceType === 'DRIVER' && !await db.driver.findFirst({ where: { id: sourceId, isActive: true, isDeleted: false }, select: { id: true } })) {
      return NextResponse.json({ error: 'Active driver not found.' }, { status: 404 })
    }

    const uniqueWhere = sourceType === 'DRIVER'
      ? { driverId_documentType: { driverId: sourceId, documentType } }
      : sourceType === 'TRUCK'
        ? { truckId_documentType: { truckId: sourceId, documentType } }
        : { trailerId_documentType: { trailerId: sourceId, documentType } }
    const existingDocument = await db.vehicleDocument.findUnique({ where: uniqueWhere as any, select: { id: true, title: true, notes: true } })
    await requireRolePermission(request, sourceType === 'TRAILER' ? 'trailers' : 'trucks', existingDocument ? 'update' : 'create')
    const fileRequired = documentType !== 'Fire extinguisher' && !existingDocument
    if (fileRequired && !file) return NextResponse.json({ error: 'Choose a document file.' }, { status: 400 })

    const validFromText = String(form.get('validFrom') || '').trim()
    const validUntilText = String(form.get('validUntil') || '').trim()
    const enteredValidFrom = parseDateInput(validFromText)
    const validUntil = parseDateInput(validUntilText)
    if ((validFromText && !enteredValidFrom) || (validUntilText && !validUntil)) {
      return NextResponse.json({ error: 'Enter valid document dates.' }, { status: 400 })
    }
    if ((isExpiryDocument || isDriverCard) && !validUntil) {
      return NextResponse.json({ error: 'Expiry date is required.' }, { status: 400 })
    }
    const tracksExpiry = isExpiryDocument || isDriverCard
    const validFrom = tracksExpiry && validUntil ? enteredValidFrom || oneYearBefore(validUntil) : null
    const reminderStartDate = validUntil ? new Date(validUntil.getTime() - 10 * 24 * 60 * 60 * 1000) : null
    if (validFrom && validUntil && validUntil < validFrom) {
      return NextResponse.json({ error: 'Expiry date must be after the valid-from date.' }, { status: 400 })
    }
    const fileFields = file ? {
      fileName: file.name.replace(/[\r\n"\\/]/g, '_').slice(0, 180),
      mimeType: file.type,
      fileSize: file.size,
      fileData: Buffer.from(await file.arrayBuffer()),
    } : { fileName: null, mimeType: null, fileSize: null, fileData: null }
    const submittedTitle = String(form.get('title') || '').trim().slice(0, 120)
    const data = {
      truckId: sourceType === 'TRUCK' ? sourceId : null,
      trailerId: sourceType === 'TRAILER' ? sourceId : null,
      driverId: sourceType === 'DRIVER' ? sourceId : null,
      vehicleId: null,
      title: submittedTitle || file?.name || existingDocument?.title || documentType,
      documentType,
      validFrom: tracksExpiry ? validFrom : null,
      validUntil: tracksExpiry ? validUntil : null,
      reminderStartDate: tracksExpiry ? reminderStartDate : null,
      notes: String(form.get('notes') || '').trim().slice(0, 2000) || existingDocument?.notes || null,
    }
    const document = await db.vehicleDocument.upsert({
      where: uniqueWhere as any,
      create: { ...data, ...fileFields },
      update: { ...data, truckId: undefined, trailerId: undefined, driverId: undefined, vehicleId: undefined, ...(file ? fileFields : {}) },
      select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, validFrom: true, validUntil: true, reminderStartDate: true, notes: true, createdAt: true },
    })
    return NextResponse.json({ document })
  } catch (error) {
    const status = statusFor(error)
    return safeError(status, 'Could not save the vehicle document.')
  }
}
