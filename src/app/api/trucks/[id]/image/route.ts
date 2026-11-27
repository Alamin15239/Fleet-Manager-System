import { NextRequest, NextResponse } from 'next/server'
import { requireRolePermission } from '@/lib/permission-middleware'
import { db } from '@/lib/db'
import { getOrganizationObject, isOrganizationObjectKey } from '@/lib/object-storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRolePermission(request, 'trucks', 'read')
    const { id } = await params
    const truck = await db.truck.findFirst({
      where: { id, isDeleted: false },
      select: { image: true },
    })
    const value = truck?.image || ''
    if (!value.startsWith('s3://')) return NextResponse.json({ error: 'Truck image not found' }, { status: 404 })
    const key = value.slice(5)
    const organizationId = user.organizationId || user.organizationSlug || 'primary'
    if (!isOrganizationObjectKey(key, organizationId)) return NextResponse.json({ error: 'Truck image not found' }, { status: 404 })
    const object = await getOrganizationObject(key)
    if (!object.contentType.startsWith('image/')) return NextResponse.json({ error: 'Invalid truck image' }, { status: 415 })
    return new NextResponse(object.body, { headers: {
      'Content-Type': object.contentType,
      'Content-Length': String(object.contentLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const unauthorized = ['No token provided', 'Invalid token'].includes(message)
    const forbidden = message === 'Insufficient permissions'
    return NextResponse.json({ error: unauthorized ? 'Authentication required' : forbidden ? 'Access denied' : 'Could not retrieve truck image' }, {
      status: unauthorized ? 401 : forbidden ? 403 : 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
