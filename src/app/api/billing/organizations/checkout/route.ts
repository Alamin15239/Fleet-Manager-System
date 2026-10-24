import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { controlDb } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limiter'
import { appBaseUrl, createStripeOrganizationCheckout, retrieveAnnualStripePrice } from '@/lib/stripe'

export const runtime = 'nodejs'
export const maxDuration = 20

const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(48),
  ownerName: z.string().trim().min(1).max(100),
  ownerEmail: z.string().trim().email().max(254),
  callingCode: z.string().trim().regex(/^\+[1-9]\d{0,3}$/),
  phone: z.string().trim().regex(/^\d[\d\s().-]{5,18}\d$/),
  acceptedTerms: z.literal(true)
})

export async function GET() {
  try {
    const price = await retrieveAnnualStripePrice()
    return NextResponse.json({
      price: { amountMinor: price.unit_amount, currency: price.currency.toUpperCase(), interval: 'year' }
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Annual checkout is not configured yet.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(request: NextRequest) {
  let organizationId: string | null = null
  let createdRegistryRow = false
  let stripeSessionCreated = false
  try {
    const limit = rateLimit(request, { windowMs: 15 * 60 * 1000, maxRequests: 8 })
    if (!limit.success) return NextResponse.json({ error: 'Too many checkout attempts. Please wait and try again.' }, { status: 429 })
    const parsed = checkoutSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter valid organization and administrator details, and accept the annual renewal terms.' }, { status: 400 })
    }

    const appUrl = appBaseUrl()
    const price = await retrieveAnnualStripePrice()
    const organizationModel = (controlDb as any).organization
    const slug = parsed.data.slug.toLowerCase()
    const attemptId = randomUUID()
    const ownerEmail = parsed.data.ownerEmail.toLowerCase()
    const existing = await organizationModel.findUnique({
      where: { slug },
      select: { id: true, ownerEmail: true, status: true, billingStatus: true, neonProjectId: true }
    })
    let organization
    if (existing) {
      const canRetry = existing.status === 'PROVISIONING'
        && existing.billingStatus === 'CHECKOUT_FAILED'
        && !existing.neonProjectId
        && existing.ownerEmail?.toLowerCase() === ownerEmail
      if (!canRetry) return NextResponse.json({ error: 'That workspace code is already in use. Choose another code.' }, { status: 409 })
      organization = await organizationModel.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          ownerName: parsed.data.ownerName,
          ownerPhone: `${parsed.data.callingCode} ${parsed.data.phone.replace(/\s+/g, ' ').trim()}`,
          billingStatus: 'CHECKOUT_PENDING',
          billingAmountMinor: price.unit_amount,
          billingCurrency: price.currency.toUpperCase(),
          billingConsentAt: new Date(),
          billingConsentVersion: 'annual-auto-renew-2026-10-24',
          billingAttemptId: attemptId,
          stripePriceId: price.id,
          stripeCheckoutSessionId: null
        }
      })
    } else {
      organization = await organizationModel.create({
        data: {
          name: parsed.data.name,
          slug,
          ownerName: parsed.data.ownerName,
          ownerEmail,
          ownerPhone: `${parsed.data.callingCode} ${parsed.data.phone.replace(/\s+/g, ' ').trim()}`,
          status: 'PROVISIONING',
          isPrimary: false,
          billingProvider: 'STRIPE',
          billingStatus: 'CHECKOUT_PENDING',
          billingAmountMinor: price.unit_amount,
          billingCurrency: price.currency.toUpperCase(),
          billingConsentAt: new Date(),
          billingConsentVersion: 'annual-auto-renew-2026-10-24',
          billingAttemptId: attemptId,
          stripePriceId: price.id
        }
      })
      createdRegistryRow = true
    }
    organizationId = organization.id

    const session = await createStripeOrganizationCheckout({
      organizationId: organization.id,
      organizationName: organization.name,
      slug: organization.slug,
      billingAttemptId: attemptId,
      ownerName: organization.ownerName,
      ownerEmail: organization.ownerEmail,
      appUrl,
      idempotencyKey: `org-checkout-${organization.id}-${attemptId}`
    })
    stripeSessionCreated = true
    if (!session.url) throw new Error('Stripe did not return a hosted checkout URL.')

    await organizationModel.update({
      where: { id: organization.id },
      data: { stripeCheckoutSessionId: session.id }
    })
    return NextResponse.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (organizationId && createdRegistryRow && !stripeSessionCreated) {
      // There is no organization database yet; remove only this unpublished
      // registry row if session creation failed, so the workspace code can be retried.
      await (controlDb as any).organization.deleteMany({ where: { id: organizationId, stripeCheckoutSessionId: null } }).catch(() => undefined)
    } else if (organizationId && !stripeSessionCreated) {
      await (controlDb as any).organization.updateMany({
        where: { id: organizationId, stripeCheckoutSessionId: null, billingStatus: 'CHECKOUT_PENDING' },
        data: { billingStatus: 'CHECKOUT_FAILED' }
      }).catch(() => undefined)
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'That workspace code is already in use. Choose another code.' }, { status: 409 })
    }
    console.error('Unable to create Stripe organization checkout:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Could not start checkout. Please confirm the Stripe test price and server settings, then try again.' }, { status: 503 })
  }
}
