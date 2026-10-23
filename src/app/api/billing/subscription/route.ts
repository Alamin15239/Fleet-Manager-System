import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { controlDb, getPrimaryOrganization } from '@/lib/db'

export const dynamic = 'force-dynamic'

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'No token provided' || message === 'Invalid token') return NextResponse.json({ error: 'Sign in to manage billing.' }, { status: 401 })
  return null
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Only a workspace administrator can view billing details.' }, { status: 403 })
    const organization = user.organizationId
      ? await (controlDb as any).organization.findUnique({ where: { id: user.organizationId } })
      : await getPrimaryOrganization()
    if (!organization) return NextResponse.json({ error: 'Workspace billing information was not found.' }, { status: 404 })
    const payments = organization.billingProvider === 'TAP'
      ? await (controlDb as any).organizationBillingPayment.findMany({
          where: { organizationId: organization.id },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: { id: true, kind: true, amountMinor: true, currency: true, status: true, periodStart: true, periodEnd: true, createdAt: true, failureReason: true }
        })
      : []
    return NextResponse.json({
      organization: { id: organization.id, name: organization.name, slug: organization.slug, isPrimary: organization.isPrimary },
      billing: organization.billingProvider ? {
        provider: organization.billingProvider,
        status: organization.billingStatus,
        amountMinor: organization.billingAmountMinor,
        currency: organization.billingCurrency,
        periodStart: organization.billingCurrentPeriodStart,
        periodEnd: organization.billingCurrentPeriodEnd,
        cancelAtPeriodEnd: organization.billingCancelAtPeriodEnd,
        renewalConfigured: Boolean(organization.tapCustomerId && organization.tapCardId && organization.tapPaymentAgreementId),
        cardBrand: organization.tapCardBrand,
        cardLast4: organization.tapCardLast4,
        payments
      } : null,
      canManage: user.role === 'ADMIN' && !organization.isPrimary
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    return authError(error) || NextResponse.json({ error: 'Could not load subscription details.' }, { status: 500 })
  }
}
