import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireRolePermission } from '@/lib/permission-middleware'
import { getOrganizationObject, isOrganizationObjectKey } from '@/lib/object-storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request)
    const { id } = await params
    const document = await db.document.findUnique({ where: { id }, select: { type: true, fileUrl: true, title: true } })
    if (!document?.fileUrl?.startsWith('s3://')) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    await requireRolePermission(request, document.type === 'truck' ? 'trucks' : 'maintenance', 'read')
    const key = document.fileUrl.slice(5)
    if (!isOrganizationObjectKey(key)) return NextResponse.json({ error: 'File not found' }, { status: 404 })
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
    await requireAuth(request)
    const { id } = await params
    const document = await db.document.findUnique({ where: { id }, select: { type: true, fileUrl: true } })
    if (!document?.fileUrl?.startsWith('s3://')) return NextResponse.json({ error: 'File not found or is not stored in object storage' }, { status: 404 })
    await requireRolePermission(request, document.type === 'truck' ? 'trucks' : 'maintenance', 'delete')
    const key = document.fileUrl.slice(5)
    if (!isOrganizationObjectKey(key)) return NextResponse.json({ error: 'File not found' }, { status: 404 })
    await deleteOrganizationObject(key)
    await db.document.delete({ where: { id } })
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token', 'User not found or inactive'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not delete file' : 'Access denied' }, { status })
  }
}
