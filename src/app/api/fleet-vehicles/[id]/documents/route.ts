import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const maxFileBytes = 4 * 1024 * 1024
const allowedDocumentTypes = new Set(['Fire extinguisher', 'Operation card', 'Istimara', 'Insurance', 'Driver card', 'Fahas'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRolePermission(request, 'trucks', 'read')
    const { id } = await params
    const documents = await db.vehicleDocument.findMany({
      where: { vehicleId: id },
      select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, validFrom: true, validUntil: true, reminderStartDate: true, notes: true, createdAt: true },
      orderBy: [{ validUntil: 'asc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json({ documents })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not load vehicle documents' : 'Access denied' }, { status })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRolePermission(request, 'trucks', 'create')
    const { id } = await params
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a document or image.' }, { status: 400 })
    if (file.size > maxFileBytes) return NextResponse.json({ error: 'Documents must be 10 MB or smaller.' }, { status: 400 })
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'Upload a PDF, JPG, PNG, or WEBP file.' }, { status: 400 })

    const validFromText = String(form.get('validFrom') || '').trim()
    const validUntilText = String(form.get('validUntil') || '').trim()
    const reminderText = String(form.get('reminderStartDate') || '').trim()
    const documentType = String(form.get('documentType') || '').trim()
    if (!allowedDocumentTypes.has(documentType)) return NextResponse.json({ error: 'Choose one of the supported vehicle document types.' }, { status: 400 })
    if (!validUntilText || !reminderText) return NextResponse.json({ error: 'Expiry date and reminder start date are required.' }, { status: 400 })
    const validFrom = validFromText ? new Date(validFromText) : null
    const validUntil = validUntilText ? new Date(validUntilText) : null
    const reminderStartDate = reminderText ? new Date(reminderText) : null
    if ([validFrom, validUntil, reminderStartDate].some(date => date && Number.isNaN(date.getTime()))) return NextResponse.json({ error: 'Enter valid document dates.' }, { status: 400 })
    if (validFrom && validUntil && validUntil < validFrom) return NextResponse.json({ error: 'Valid until must be after valid from.' }, { status: 400 })
    if (reminderStartDate && validUntil && reminderStartDate > validUntil) return NextResponse.json({ error: 'Reminder date must be before the expiry date.' }, { status: 400 })

    const documentData = {
        vehicleId: id,
        title: String(form.get('title') || file.name).trim().slice(0, 120) || file.name,
        documentType,
        fileName: file.name.replace(/[\r\n"\\/]/g, '_').slice(0, 180),
        mimeType: file.type,
        fileSize: file.size,
        fileData: Buffer.from(await file.arrayBuffer()),
        validFrom,
        validUntil,
        reminderStartDate,
        notes: String(form.get('notes') || '').trim().slice(0, 2000) || null,
      }
    const document = await db.vehicleDocument.upsert({
      where: { vehicleId_documentType: { vehicleId: id, documentType } },
      create: documentData,
      update: {
        title: documentData.title,
        fileName: documentData.fileName,
        mimeType: documentData.mimeType,
        fileSize: documentData.fileSize,
        fileData: documentData.fileData,
        validFrom: documentData.validFrom,
        validUntil: documentData.validUntil,
        reminderStartDate: documentData.reminderStartDate,
        notes: documentData.notes,
      },
      select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, validFrom: true, validUntil: true, reminderStartDate: true, notes: true, createdAt: true },
    })
    return NextResponse.json({ document })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not save vehicle document' : 'Access denied' }, { status })
  }
}
