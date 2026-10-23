import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { controlDb } from '@/lib/db'
import { annualOrganizationPriceSar, applyTapCharge, createTapInitialCharge, isOrganizationBillingReady, organizationBillingProvider, ORGANIZATION_BILLING_CONSENT_VERSION } from '@/lib/organization-billing'
import { getConfiguredPaddlePrice } from '@/lib/paddle-billing'

export const runtime = 'nodejs'
export const maxDuration = 30

const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(48),
  ownerName: z.string().trim().min(2).max(100),
  ownerEmail: z.string().trim().email().max(254),
  phoneCountryCode: z.string().trim().regex(/^\+?[1-9]\d{0,2}$/),
  phone: z.string().trim().regex(/^\d{7,14}$/),
  agreedToRenewal: z.literal(true)
})

function siteOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return new URL(configured).origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  const provider = organizationBillingProvider()
  if (!isOrganizationBillingReady()) {
    return NextResponse.json({ error: `Annual checkout is not enabled yet. The administrator must finish ${provider === 'PADDLE' ? 'Paddle Sandbox' : 'Tap'} setup.` }, { status: 503 })
  }
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter the organization, administrator, phone, and annual renewal consent details.' }, { status: 400 })
  }

  const values = parsed.data
  const organizationModel = (controlDb as any).organization
  const existing = await organizationModel.findUnique({ where: { slug: values.slug } }).catch(() => null)
  if (existing && (
    existing.isPrimary ||
    existing.status === 'ACTIVE' ||
    !['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CHECKOUT_FAILED'].includes(existing.billingStatus)
  )) {
    return NextResponse.json({ error: 'That organization code is already in use. Choose a different code or sign in to the existing workspace.' }, { status: 409 })
  }

  const attemptId = randomUUID()
  let priceDetails: Awaited<ReturnType<typeof getConfiguredPaddlePrice>> | null = null
  try {
    if (provider === 'PADDLE') priceDetails = await getConfiguredPaddlePrice()
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Paddle price is not ready.' }, { status: 503 })
  }
  const amountMinor = provider === 'PADDLE' && priceDetails
    ? Number(priceDetails.unit_price?.amount)
    : annualOrganizationPriceSar() * 100
  let organization: any
  try {
    const data = {
      name: values.name,
      ownerName: values.ownerName,
      ownerEmail: values.ownerEmail.toLowerCase(),
      status: 'PROVISIONING',
      isPrimary: false,
      billingProvider: provider,
      billingStatus: 'PENDING_PAYMENT',
      billingAmountMinor: amountMinor,
      billingCurrency: provider === 'PADDLE' && priceDetails ? priceDetails.unit_price?.currency_code : 'SAR',
      billingAttemptId: attemptId,
      billingCancelAtPeriodEnd: false,
      billingConsentAt: new Date(),
      billingConsentVersion: ORGANIZATION_BILLING_CONSENT_VERSION,
      tapPendingChargeId: null,
      tapRenewalLockUntil: null,
      paddleCustomerId: null,
      paddleSubscriptionId: null,
      paddlePriceId: provider === 'PADDLE' ? priceDetails?.id : null
    }
    organization = existing
      ? await organizationModel.update({ where: { id: existing.id }, data })
      : await organizationModel.create({ data: { ...data, slug: values.slug } })

    if (provider === 'PADDLE') {
      const origin = siteOrigin(request)
      const clientToken = process.env.PADDLE_CLIENT_TOKEN?.trim()
      if (!clientToken || !priceDetails?.id) throw new Error('Paddle Sandbox checkout configuration is incomplete.')
      return NextResponse.json({
        success: true,
        provider: 'PADDLE',
        paddle: {
          clientToken,
          environment: process.env.PADDLE_ENVIRONMENT?.trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production',
          priceId: priceDetails.id,
          organizationId: organization.id,
          attemptId,
          customerEmail: values.ownerEmail.toLowerCase(),
          successUrl: `${origin}/purchase/complete?org=${encodeURIComponent(organization.slug)}`
        }
      }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    }

    const charge = await createTapInitialCharge({
      organizationId: organization.id,
      attemptId,
      name: values.ownerName,
      email: values.ownerEmail.toLowerCase(),
      countryCode: values.phoneCountryCode,
      phone: values.phone,
      origin: siteOrigin(request)
    })
    if (charge.id) {
      await organizationModel.updateMany({
        where: { id: organization.id, billingAttemptId: attemptId },
        data: { tapPendingChargeId: charge.id }
      })
    }
    if (charge.status === 'CAPTURED') {
      await applyTapCharge({ ...charge, metadata: { ...charge.metadata, udf1: organization.id, udf2: 'annual-initial', udf3: attemptId } })
      return NextResponse.json({ success: true, complete: true, redirectUrl: `/purchase/complete?org=${encodeURIComponent(organization.slug)}` }, { status: 201 })
    }
    if (charge.status && !['INITIATED', 'UNKNOWN'].includes(charge.status)) {
      await applyTapCharge({ ...charge, metadata: { ...charge.metadata, udf1: organization.id, udf2: 'annual-initial', udf3: attemptId } })
      return NextResponse.json({ error: 'Tap could not start the annual payment. Check your payment method and try again.' }, { status: 402 })
    }
    if (!charge.transaction?.url) {
      return NextResponse.json({ error: 'Tap did not return a secure checkout link. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ success: true, redirectUrl: charge.transaction.url }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Annual organization checkout could not start:', error instanceof Error ? error.message : 'Unknown error')
    if (organization?.id) {
      await organizationModel.updateMany({
        where: { id: organization.id, billingAttemptId: attemptId },
        data: { billingStatus: 'CHECKOUT_FAILED', billingAttemptId: null, tapPendingChargeId: null }
      }).catch(() => undefined)
    }
    const message = error instanceof Error ? error.message : 'Checkout could not be started.'
    return NextResponse.json({ error: message.slice(0, 240) }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
