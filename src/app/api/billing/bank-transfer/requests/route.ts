import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { controlDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN' || !user.isPrimaryOrganization) {
      return NextResponse.json({ error: 'Only the primary organization administrator can review bank transfers.' }, { status: 403 })
    }

    const requests = await (controlDb as any).organizationPurchaseRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200
    })
    return NextResponse.json({ requests }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Could not load transfer requests.' }, { status })
  }
}
