import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireRolePermission } from '@/lib/permission-middleware'
import { getOrganizationObject, isOrganizationObjectKey } from '@/lib/object-storage'
import { deleteVehicleDocumentWithCleanup } from '@/lib/storage-cleanup'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    const owner = await db.vehicleDocument.findUnique({ where: { id }, select: { truckId: true, trailerId: true, driverId: true } })
    if (!owner) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    await requireRolePermission(request, owner.trailerId ? 'trailers' : 'trucks', 'read')
    const document = await db.vehicleDocument.findUnique({ where: { id }, select: { fileName: true, mimeType: true, fileData: true } })
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    if (!document.fileData || !document.fileName) return NextResponse.json({ error: 'This record does not have an uploaded file.' }, { status: 404 })
    const pointer = Buffer.from(document.fileData).toString('utf8')
    const objectKey = pointer.startsWith('s3://') ? pointer.slice(5) : null
    const expectedOrganizationId = user.organizationId || user.organizationSlug || 'primary'
    if (objectKey && !isOrganizationObjectKey(objectKey, expectedOrganizationId)) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    const object = objectKey ? await getOrganizationObject(objectKey) : null
    const bytes = object ? object.body : Buffer.from(document.fileData)
    return new NextResponse(bytes, { headers: {
      'Content-Type': object?.contentType || document.mimeType || 'application/octet-stream',
      'Content-Length': String(object?.contentLength ?? bytes.byteLength),
      'Content-Disposition': `inline; filename="${document.fileName.replace(/[\r\n"\\]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not retrieve document' : 'Access denied' }, { status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    const owner = await db.vehicleDocument.findUnique({ where: { id }, select: { truckId: true, trailerId: true, driverId: true, fileData: true } })
    if (!owner) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    await requireRolePermission(request, owner.trailerId ? 'trailers' : 'trucks', 'delete')
    const pointer = owner.fileData ? Buffer.from(owner.fileData).toString('utf8') : ''
    const key = pointer.startsWith('s3://') ? pointer.slice(5) : null
    const expectedOrganizationId = user.organizationId || user.organizationSlug || 'primary'
    if (key && !isOrganizationObjectKey(key, expectedOrganizationId)) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    const result = await deleteVehicleDocumentWithCleanup({
      documentId: id,
      objectKey: key,
      organizationId: expectedOrganizationId,
    })
    if (!result.deleted) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    return NextResponse.json({ success: true, cleanup: result.queued ? 'queued' : 'not-required' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not delete document' : 'Access denied' }, { status })
  }
}
