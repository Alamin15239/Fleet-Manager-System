import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { controlDb } from '@/lib/db'
import { appBaseUrl, createStripeOrganizationCheckout, createStripePortalSession, retrieveAnnualStripePrice } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN' || user.isPrimaryOrganization) {
      return NextResponse.json({ error: 'Only this workspace administrator can view subscription details.' }, { status: 403 })
    }
    const organization = await (controlDb as any).organization.findUnique({
      where: { id: user.organizationId },
      select: {
        isPrimary: true,
        billingProvider: true,
        billingStatus: true,
        billingCurrency: true,
        billingAmountMinor: true,
        billingCurrentPeriodEnd: true,
        billingCancelAtPeriodEnd: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true
      }
    })
    if (!organization || organization.isPrimary || organization.billingProvider !== 'STRIPE') {
      return NextResponse.json({ error: 'This workspace has no Stripe subscription.' }, { status: 404 })
    }
    return NextResponse.json({
      billing: {
        status: organization.billingStatus,
        currency: organization.billingCurrency,
        amountMinor: organization.billingAmountMinor,
        currentPeriodEnd: organization.billingCurrentPeriodEnd,
        cancelAtPeriodEnd: organization.billingCancelAtPeriodEnd,
        portalAvailable: Boolean(organization.stripeCustomerId && organization.stripeSubscriptionId)
      }
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : 'Could not load subscription details.' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN' || user.isPrimaryOrganization) {
      return NextResponse.json({ error: 'Only this workspace administrator can manage its subscription.' }, { status: 403 })
    }
    const organization = await (controlDb as any).organization.findUnique({
      where: { id: user.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerName: true,
        ownerEmail: true,
        billingProvider: true,
        billingStatus: true,
        billingAttemptId: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true
      }
    })
    if (organization?.billingProvider !== 'STRIPE') {
      return NextResponse.json({ error: 'No Stripe subscription is linked to this workspace.' }, { status: 409 })
    }
    if (['CANCELED', 'INCOMPLETE_EXPIRED'].includes(organization.billingStatus || '')) {
      const price = await retrieveAnnualStripePrice()
      const billingAttemptId = randomUUID()
      const claim = await (controlDb as any).organization.updateMany({
        where: {
          id: organization.id,
          billingProvider: 'STRIPE',
          billingStatus: organization.billingStatus,
          billingAttemptId: organization.billingAttemptId
        },
        data: { billingAttemptId, stripePriceId: price.id, stripeCheckoutSessionId: null }
      })
      if (claim.count !== 1) return NextResponse.json({ error: 'Billing status changed. Refresh and try again.' }, { status: 409 })

      const checkout = await createStripeOrganizationCheckout({
        organizationId: organization.id,
        organizationName: organization.name,
        slug: organization.slug,
        billingAttemptId,
        ownerName: organization.ownerName || '',
        ownerEmail: organization.ownerEmail || user.email,
        appUrl: appBaseUrl(),
        idempotencyKey: `org-renew-${organization.id}-${billingAttemptId}`
      })
      if (!checkout.url) throw new Error('Stripe did not return a hosted Checkout URL.')
      await (controlDb as any).organization.updateMany({
        where: { id: organization.id, billingAttemptId, stripeCheckoutSessionId: null },
        data: { stripeCheckoutSessionId: checkout.id }
      })
      return NextResponse.json({ url: checkout.url, flow: 'checkout' }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (!organization.stripeCustomerId || !organization.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active Stripe customer subscription is linked to this workspace.' }, { status: 409 })
    }
    const portal = await createStripePortalSession(organization.stripeCustomerId, `${appBaseUrl()}/billing`)
    return NextResponse.json({ url: portal.url, flow: 'portal' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required.' : 'Could not open subscription management.' }, { status })
  }
}
