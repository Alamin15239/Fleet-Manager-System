import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireRolePermission } from '@/lib/permission-middleware'
import { deleteOrganizationObject, getOrganizationObject, isOrganizationObjectKey, putOrganizationObject } from '@/lib/object-storage'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function hasFileSignature(buffer: Buffer, mimeType: string) {
  const startsWith = (signature: number[]) => buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(Buffer.from(signature))
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg': return startsWith([0xff, 0xd8, 0xff])
    case 'image/png': return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/gif': return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
    case 'application/pdf': return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    case 'application/msword':
    case 'application/vnd.ms-excel': return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return startsWith([0x50, 0x4b, 0x03, 0x04])
    default: return false
  }
}

const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
  'application/pdf': '.pdf', 'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
}

export async function POST(request: NextRequest) {
  let uploadedKey: string | undefined
  try {
    const authUser = await requireAuth(request)
    const data = await request.formData()
    const type = String(data.get('type') || '').toLowerCase()
    if (type !== 'truck' && type !== 'maintenance') {
      return NextResponse.json({ error: 'Unsupported upload section' }, { status: 400 })
    }
    const entityId = String(data.get('entityId') || '').trim()
    if (!entityId || entityId.length > 128) {
      return NextResponse.json({ error: 'A valid truck or maintenance record is required' }, { status: 400 })
    }
    const permissionResource = type === 'truck' ? 'trucks' : 'maintenance'
    const user = await requireRolePermission(request, permissionResource, 'update')
    const parentExists = type === 'truck'
      ? Boolean(await db.truck.findFirst({ where: { id: entityId, isDeleted: false }, select: { id: true } }))
      : Boolean(
          (await db.maintenanceRecord.findFirst({ where: { id: entityId, isDeleted: false }, select: { id: true } })) ||
          (await db.trailerMaintenanceRecord.findFirst({ where: { id: entityId, isDeleted: false }, select: { id: true } }))
        )
    if (!parentExists) return NextResponse.json({ error: 'The selected fleet record was not found' }, { status: 404 })

    const submittedFile = data.get('file')
    if (!(submittedFile instanceof File) || submittedFile.size <= 0) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    const file = submittedFile
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'File is too large. Maximum size is 10 MB.' }, { status: 413 })
    const extension = ALLOWED_UPLOAD_TYPES[file.type]
    if (!extension) return NextResponse.json({ error: 'Unsupported file type. Upload an image, PDF, Word, or Excel document.' }, { status: 415 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (!hasFileSignature(buffer, file.type)) return NextResponse.json({ error: 'The uploaded file content does not match its declared file type.' }, { status: 415 })
    const originalName = file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'upload' + extension

    const stored = await putOrganizationObject({
      organizationId: authUser.organizationId || authUser.organizationSlug || 'primary',
      module: type === 'truck' ? 'truck-documents' : 'maintenance-documents',
      entityId,
      fileName: originalName,
      contentType: file.type,
      body: buffer,
    })
    uploadedKey = stored.key

    let documentRecord
    try {
      documentRecord = await db.document.create({
        data: { title: originalName, type, fileUrl: 's3://' + stored.key, createdById: user.id },
        select: { id: true },
      })
    } catch (dbError) {
      console.error('Error saving file metadata to database:', dbError)
      await deleteOrganizationObject(stored.key).catch(cleanupError => console.error('Failed to clean up untracked object:', cleanupError))
      uploadedKey = undefined
      return NextResponse.json({ error: 'File metadata could not be saved. Please retry the upload.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }

    const fileUrl = '/api/upload/' + documentRecord.id
    return NextResponse.json({
      id: documentRecord.id, name: randomUUID() + extension, originalName, size: file.size,
      type: file.type, url: fileUrl, uploadedAt: new Date().toISOString(), uploadedBy: user.id,
    }, { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('Error uploading file:', error)
    const message = error instanceof Error ? error.message : ''
    if (['No token provided', 'Invalid token', 'User not found or inactive'].includes(message)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (message === 'Insufficient permissions') return NextResponse.json({ error: 'You do not have permission to upload files for this section' }, { status: 403 })
    if (uploadedKey) await deleteOrganizationObject(uploadedKey).catch(cleanupError => console.error('Failed to clean up failed upload:', cleanupError))
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request)
    const { id } = await params
    const document = await db.document.findUnique({ where: { id }, select: { type: true, fileUrl: true, title: true } })
    if (!document || !document.fileUrl || !document.fileUrl.startsWith('s3://')) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    await requireRolePermission(request, document.type === 'truck' ? 'trucks' : 'maintenance', 'read')
    const key = document.fileUrl.slice(5)
    if (!isOrganizationObjectKey(key)) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    const object = await getOrganizationObject(key)
    const safeName = (document.title || 'download').replace(/[\r\n"\\]/g, '_')
    return new NextResponse(object.body, { headers: {
      'Content-Type': object.contentType, 'Content-Length': String(object.contentLength),
      'Content-Disposition': 'inline; filename="' + safeName + '"',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token', 'User not found or inactive'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not retrieve file' : 'Access denied' }, { status })
  }
}
