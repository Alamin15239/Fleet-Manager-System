import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireRolePermission } from '@/lib/permission-middleware'
import { deleteOrganizationObject, getOrganizationObject, isOrganizationObjectKey } from '@/lib/object-storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    const document = await db.document.findUnique({ where: { id }, select: { type: true, fileUrl: true, title: true, editorState: true } })
    if (!document?.fileUrl?.startsWith('s3://')) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    const resource = document.type === 'truck' ? 'trucks' : document.type === 'purchase-invoice' ? 'purchase-invoices' : 'maintenance'
    await requireRolePermission(request, resource, 'read')
    const key = document.fileUrl.slice(5)
    const storageMeta = (document.editorState as any)?.storage
    const expectedOrganizationId = user.organizationId || user.organizationSlug || 'primary'
    if (!isOrganizationObjectKey(key, expectedOrganizationId) || storageMeta?.organizationId !== expectedOrganizationId || storageMeta?.entityId == null || storageMeta?.module !== (document.type === 'truck' ? 'truck-documents' : document.type === 'purchase-invoice' ? 'purchase-invoice-documents' : 'maintenance-documents')) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const parentExists = document.type === 'purchase-invoice'
      ? Boolean(await db.purchaseInvoice.findUnique({ where: { id: String(storageMeta.entityId) }, select: { id: true } }))
      : document.type === 'truck'
        ? Boolean(await db.truck.findFirst({ where: { id: String(storageMeta.entityId), isDeleted: false }, select: { id: true } }))
        : Boolean(
          (await db.maintenanceRecord.findFirst({ where: { id: String(storageMeta.entityId), isDeleted: false }, select: { id: true } })) ||
          (await db.trailerMaintenanceRecord.findFirst({ where: { id: String(storageMeta.entityId), isDeleted: false }, select: { id: true } })) ||
          (await db.workshopJobCard.findFirst({ where: { id: String(storageMeta.entityId) }, select: { id: true } }))
        )
    if (!parentExists) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    const object = await getOrganizationObject(key)
    const safeName = (document.title || 'download').replace(/[\r\n"\\]/g, '_')
    return new NextResponse(object.body, { headers: {
      'Content-Type': object.contentType,
      'Content-Length': String(object.contentLength),
      'Content-Disposition': 'inline; filename="' + safeName + '"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token', 'User not found or inactive'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not retrieve file' : 'Access denied' }, { status })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request)
    const { id } = await params
    const document = await db.document.findUnique({ where: { id }, select: { type: true, fileUrl: true, editorState: true } })
    if (!document?.fileUrl?.startsWith('s3://')) return NextResponse.json({ error: 'File not found or is not stored in object storage' }, { status: 404 })
    const resource = document.type === 'truck' ? 'trucks' : document.type === 'purchase-invoice' ? 'purchase-invoices' : 'maintenance'
    await requireRolePermission(request, resource, 'delete')
    const key = document.fileUrl.slice(5)
    const storageMeta = (document.editorState as any)?.storage
    const expectedOrganizationId = user.organizationId || user.organizationSlug || 'primary'
    if (!isOrganizationObjectKey(key, expectedOrganizationId) || storageMeta?.organizationId !== expectedOrganizationId || storageMeta?.entityId == null || storageMeta?.module !== (document.type === 'truck' ? 'truck-documents' : document.type === 'purchase-invoice' ? 'purchase-invoice-documents' : document.type === 'maintenance' ? 'maintenance-documents' : '')) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    const parentExists = document.type === 'purchase-invoice'
      ? Boolean(await db.purchaseInvoice.findUnique({ where: { id: String(storageMeta.entityId) }, select: { id: true } }))
      : document.type === 'truck'
        ? Boolean(await db.truck.findFirst({ where: { id: String(storageMeta.entityId), isDeleted: false }, select: { id: true } }))
        : Boolean(
          (await db.maintenanceRecord.findFirst({ where: { id: String(storageMeta.entityId), isDeleted: false }, select: { id: true } })) ||
          (await db.trailerMaintenanceRecord.findFirst({ where: { id: String(storageMeta.entityId), isDeleted: false }, select: { id: true } })) ||
          (await db.workshopJobCard.findFirst({ where: { id: String(storageMeta.entityId) }, select: { id: true } }))
        )
    if (!parentExists) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    await db.document.delete({ where: { id } })
    await deleteOrganizationObject(key).catch(error => console.error('Stored upload cleanup failed:', error))
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token', 'User not found or inactive'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not delete file' : 'Access denied' }, { status })
  }
}
