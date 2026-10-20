import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const owner = await db.vehicleDocument.findUnique({ where: { id }, select: { truckId: true, trailerId: true } })
    if (!owner) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    await requireRolePermission(request, owner.trailerId ? 'trailers' : 'trucks', 'read')
    const document = await db.vehicleDocument.findUnique({ where: { id }, select: { fileName: true, mimeType: true, fileData: true } })
    if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    if (!document.fileData || !document.fileName) return NextResponse.json({ error: 'This record does not have an uploaded file.' }, { status: 404 })
    const bytes = new Uint8Array(document.fileData)
    return new NextResponse(bytes, { headers: {
      'Content-Type': document.mimeType || 'application/octet-stream',
      'Content-Length': String(bytes.byteLength),
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
    const { id } = await params
    const owner = await db.vehicleDocument.findUnique({ where: { id }, select: { truckId: true, trailerId: true } })
    if (!owner) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    await requireRolePermission(request, owner.trailerId ? 'trailers' : 'trucks', 'delete')
    await db.vehicleDocument.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not delete document' : 'Access denied' }, { status })
  }
}
