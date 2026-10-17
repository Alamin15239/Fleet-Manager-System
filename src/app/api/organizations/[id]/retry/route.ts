import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { controlDb } from '@/lib/db'
import { provisionOrganization } from '@/lib/organization-provisioning'

export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN' || !user.isPrimaryOrganization) {
      return NextResponse.json({ error: 'Only an administrator of the original organization can manage organizations' }, { status: 403 })
    }

    const { id } = await params
    const organizationModel = (controlDb as any).organization
    const organization = await organizationModel.findUnique({ where: { id } })
    if (!organization || organization.isPrimary) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    if (organization.status !== 'FAILED') {
      return NextResponse.json({ error: 'Only a failed organization setup can be retried' }, { status: 409 })
    }

    await organizationModel.update({ where: { id }, data: { status: 'PROVISIONING', failureReason: null } })
    await provisionOrganization(id)
    return NextResponse.json({ success: true, status: 'ACTIVE' }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : 502
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : message || 'Could not retry organization setup' }, { status })
  }
}
