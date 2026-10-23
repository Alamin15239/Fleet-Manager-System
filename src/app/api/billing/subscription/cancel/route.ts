import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { controlDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Only a workspace administrator can change billing.' }, { status: 403 })
    if (!user.organizationId || user.isPrimaryOrganization !== false) {
      return NextResponse.json({ error: 'The original workspace does not have a paid subscription to cancel.' }, { status: 400 })
    }
    const organization = await (controlDb as any).organization.findUnique({ where: { id: user.organizationId } })
    if (!organization || organization.billingProvider !== 'TAP' || !['ACTIVE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END'].includes(organization.billingStatus)) {
      return NextResponse.json({ error: 'There is no active annual subscription to change.' }, { status: 409 })
    }
    if (!organization.billingCurrentPeriodEnd || organization.billingCurrentPeriodEnd <= new Date()) {
      return NextResponse.json({ error: 'This annual subscription has already expired.' }, { status: 409 })
    }
    const action = (await request.json().catch(() => ({})))?.action
    if (action !== 'cancel' && action !== 'resume') return NextResponse.json({ error: 'Choose cancel or resume.' }, { status: 400 })
    const cancel = action === 'cancel'
    await (controlDb as any).organization.update({
      where: { id: organization.id },
      data: { billingCancelAtPeriodEnd: cancel, billingStatus: cancel ? 'CANCEL_AT_PERIOD_END' : 'ACTIVE' }
    })
    return NextResponse.json({ success: true, cancelAtPeriodEnd: cancel, periodEnd: organization.billingCurrentPeriodEnd })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'No token provided' || message === 'Invalid token') return NextResponse.json({ error: 'Sign in to manage billing.' }, { status: 401 })
    return NextResponse.json({ error: 'Could not update subscription settings.' }, { status: 500 })
  }
}
