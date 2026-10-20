import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

const allowedFiles = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const allowedDocumentTypes = new Set(['Fire extinguisher', 'Operation card', 'Istimara', 'Insurance', 'Driver card', 'Fahas'])
const maxFileBytes = 4 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trucks', 'create')
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a document file.' }, { status: 400 })
    if (file.size > maxFileBytes) return NextResponse.json({ error: 'Vehicle documents must be 4 MB or smaller.' }, { status: 400 })
    if (!allowedFiles.has(file.type)) return NextResponse.json({ error: 'Upload a PDF, JPG, PNG, or WEBP file.' }, { status: 400 })

    const sourceType = String(form.get('sourceType') || '')
    const sourceId = String(form.get('sourceId') || '').trim()
    const documentType = String(form.get('documentType') || '').trim()
    if (!sourceId || !['FLEET', 'TRUCK', 'TRAILER'].includes(sourceType)) return NextResponse.json({ error: 'Select a valid fleet vehicle.' }, { status: 400 })
    if (!allowedDocumentTypes.has(documentType)) return NextResponse.json({ error: 'Choose a supported vehicle document type.' }, { status: 400 })

    if (sourceType === 'FLEET' && !await db.fleetVehicle.findUnique({ where: { id: sourceId }, select: { id: true } })) return NextResponse.json({ error: 'Vehicle master record not found.' }, { status: 404 })
    if (sourceType === 'TRUCK' && !await db.truck.findFirst({ where: { id: sourceId, isDeleted: false }, select: { id: true } })) return NextResponse.json({ error: 'Active truck not found.' }, { status: 404 })
    if (sourceType === 'TRAILER' && !await db.trailer.findFirst({ where: { id: sourceId, isDeleted: false }, select: { id: true } })) return NextResponse.json({ error: 'Active trailer not found.' }, { status: 404 })

    const validFromText = String(form.get('validFrom') || '').trim()
    const validUntilText = String(form.get('validUntil') || '').trim()
    const reminderText = String(form.get('reminderStartDate') || '').trim()
    if (!validUntilText || !reminderText) return NextResponse.json({ error: 'Expiry date and reminder start date are required.' }, { status: 400 })
    const validFrom = validFromText ? new Date(validFromText) : null
    const validUntil = new Date(validUntilText)
    const reminderStartDate = new Date(reminderText)
    if ([validFrom, validUntil, reminderStartDate].some(date => date && Number.isNaN(date.getTime()))) return NextResponse.json({ error: 'Enter valid document dates.' }, { status: 400 })
    if (validFrom && validUntil < validFrom) return NextResponse.json({ error: 'Expiry date must be after the valid-from date.' }, { status: 400 })
    if (reminderStartDate > validUntil) return NextResponse.json({ error: 'Reminder must start on or before the expiry date.' }, { status: 400 })

    const sourceFields = {
      vehicleId: sourceType === 'FLEET' ? sourceId : null,
      truckId: sourceType === 'TRUCK' ? sourceId : null,
      trailerId: sourceType === 'TRAILER' ? sourceId : null,
    }
    const uniqueWhere = sourceType === 'FLEET'
      ? { vehicleId_documentType: { vehicleId: sourceId, documentType } }
      : sourceType === 'TRUCK'
        ? { truckId_documentType: { truckId: sourceId, documentType } }
        : { trailerId_documentType: { trailerId: sourceId, documentType } }
    const fileData = Buffer.from(await file.arrayBuffer())
    const data = {
      ...sourceFields,
      title: String(form.get('title') || file.name).trim().slice(0, 120) || file.name,
      documentType,
      fileName: file.name.replace(/[\r\n"\\/]/g, '_').slice(0, 180),
      mimeType: file.type,
      fileSize: file.size,
      fileData,
      validFrom,
      validUntil,
      reminderStartDate,
      notes: String(form.get('notes') || '').trim().slice(0, 2000) || null,
    }
    const document = await db.vehicleDocument.upsert({
      where: uniqueWhere as any,
      create: data,
      update: { title: data.title, fileName: data.fileName, mimeType: data.mimeType, fileSize: data.fileSize, fileData, validFrom, validUntil, reminderStartDate, notes: data.notes },
      select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, validFrom: true, validUntil: true, reminderStartDate: true, notes: true, createdAt: true },
    })
    return NextResponse.json({ document })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not save the vehicle document.' : 'Access denied.' }, { status })
  }
}
