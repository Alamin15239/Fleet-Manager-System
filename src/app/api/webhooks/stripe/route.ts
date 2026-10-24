import { NextRequest, NextResponse } from 'next/server'
import { controlDb } from '@/lib/db'
import { provisionOrganization } from '@/lib/organization-provisioning'
import {
  retrieveStripeSubscription,
  stripeIsLiveMode,
  stripeWebhookSecret,
  verifyStripeWebhookSignature,
  type StripeCheckoutSession,
  type StripeEvent,
  type StripeSubscription
} from '@/lib/stripe'

export const runtime = 'nodejs'
export const maxDuration = 60

function unixDate(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null
}

function subscriptionId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id
  return null
}

function checkoutSessionMatch(session: StripeCheckoutSession) {
  const matches: Array<Record<string, string | null>> = [{ stripeCheckoutSessionId: session.id }]
  const attemptId = session.metadata?.billingAttemptId
  if (attemptId) matches.push({ stripeCheckoutSessionId: null, billingAttemptId: attemptId })
  return { OR: matches }
}

async function getOrganizationModel() {
  return (controlDb as any).organization
}

async function activatePurchasedOrganization(session: StripeCheckoutSession) {
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return
  const organizationId = session.metadata?.organizationId || session.client_reference_id
  const subId = subscriptionId(session.subscription)
  if (!organizationId || !subId) throw new Error('Checkout session is missing its organization or subscription reference.')
  if (session.status !== 'complete') return

  const subscription = await retrieveStripeSubscription(subId)
  if (!['active', 'trialing'].includes(subscription.status)) return
  const organizationModel = await getOrganizationModel()
  const before = await organizationModel.findUnique({
    where: { id: organizationId },
    select: { status: true, encryptedDatabaseUrl: true, neonProjectId: true }
  })
  const periodStart = unixDate(subscription.current_period_start)
  const periodEnd = unixDate(subscription.current_period_end)
  const updated = await organizationModel.updateMany({
    where: {
      id: organizationId,
      isPrimary: false,
      billingProvider: 'STRIPE',
      ...checkoutSessionMatch(session),
      billingStatus: { in: ['CHECKOUT_PENDING', 'CHECKOUT_FAILED', 'PROVISIONING_FAILED', 'PROVISIONING', 'CANCELED', 'UNPAID', 'INCOMPLETE_EXPIRED'] },
      status: { in: ['PROVISIONING', 'FAILED', 'ACTIVE'] }
    },
    data: {
      billingStatus: 'PROVISIONING',
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: subscription.customer || session.customer,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items?.data?.[0]?.price?.id || undefined,
      billingAmountMinor: subscription.items?.data?.[0]?.price?.unit_amount ?? session.amount_total ?? undefined,
      billingCurrency: (subscription.items?.data?.[0]?.price?.currency || session.currency || undefined)?.toUpperCase(),
      billingCurrentPeriodStart: periodStart || undefined,
      billingCurrentPeriodEnd: periodEnd || undefined,
      billingGraceUntil: null,
      billingCancelAtPeriodEnd: false
    }
  })

  if (updated.count === 0) {
    const current = await organizationModel.findUnique({ where: { id: organizationId }, select: { status: true, billingStatus: true } })
    if (current?.status === 'ACTIVE' && current.billingStatus === 'ACTIVE') return
    throw new Error('The organization is not in a payable provisioning state.')
  }

  try {
    if (before?.status !== 'ACTIVE' || !before.encryptedDatabaseUrl || !before.neonProjectId) {
      await provisionOrganization(organizationId)
    }
    await organizationModel.update({
      where: { id: organizationId },
      data: { billingStatus: 'ACTIVE', failureReason: null }
    })
  } catch (error) {
    await organizationModel.update({
      where: { id: organizationId },
      data: { billingStatus: 'PROVISIONING_FAILED' }
    }).catch(() => undefined)
    throw error
  }
}

async function syncSubscription(subscription: StripeSubscription, statusOverride?: string) {
  const organizationModel = await getOrganizationModel()
  const organizationId = subscription.metadata?.organizationId
  const organization = organizationId
    ? await organizationModel.findUnique({ where: { id: organizationId }, select: { id: true, status: true, billingStatus: true, billingGraceUntil: true } })
    : await organizationModel.findFirst({ where: { stripeSubscriptionId: subscription.id }, select: { id: true, status: true, billingStatus: true, billingGraceUntil: true } })
  if (!organization) return

  const status = statusOverride || subscription.status
  const periodEnd = unixDate(subscription.current_period_end)
  const periodStart = unixDate(subscription.current_period_start)
  const active = status === 'active' || status === 'trialing'
  const pastDue = status === 'past_due' || status === 'unpaid'
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end)
  const awaitingProvisioning = ['CHECKOUT_PENDING', 'CHECKOUT_FAILED', 'PROVISIONING', 'PROVISIONING_FAILED'].includes(organization.billingStatus || '')
  const nextBillingStatus = organization.status !== 'ACTIVE' && awaitingProvisioning
    ? organization.billingStatus
    : active ? 'ACTIVE' : pastDue ? 'PAST_DUE' : status.toUpperCase()
  const graceUntil = pastDue
    ? organization.billingStatus === 'PAST_DUE' && organization.billingGraceUntil
      ? organization.billingGraceUntil
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : null
  await organizationModel.update({
    where: { id: organization.id },
    data: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      stripePriceId: subscription.items?.data?.[0]?.price?.id,
      billingStatus: nextBillingStatus,
      billingCancelAtPeriodEnd: cancelAtPeriodEnd,
      billingCurrentPeriodStart: periodStart,
      billingCurrentPeriodEnd: periodEnd,
      billingGraceUntil: graceUntil,
      billingAmountMinor: subscription.items?.data?.[0]?.price?.unit_amount ?? undefined,
      billingCurrency: subscription.items?.data?.[0]?.price?.currency?.toUpperCase()
    }
  })
}

async function handleStripeEvent(event: StripeEvent) {
  const object = event.data.object
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await activatePurchasedOrganization(object as StripeCheckoutSession)
      return
    case 'checkout.session.async_payment_failed': {
      const session = object as StripeCheckoutSession
      const organizationId = session.metadata?.organizationId || session.client_reference_id
      if (!organizationId) return
      await (controlDb as any).organization.updateMany({
        where: {
          id: organizationId,
          status: 'PROVISIONING',
          billingStatus: 'CHECKOUT_PENDING',
          neonProjectId: null,
          ...checkoutSessionMatch(session)
        },
        data: { billingStatus: 'CHECKOUT_FAILED' }
      })
      return
    }
    case 'checkout.session.expired': {
      const session = object as StripeCheckoutSession
      const organizationId = session.metadata?.organizationId || session.client_reference_id
      if (organizationId) {
        await (controlDb as any).organization.deleteMany({
          where: {
            id: organizationId,
            status: 'PROVISIONING',
            ...checkoutSessionMatch(session),
            billingStatus: 'CHECKOUT_PENDING',
            neonProjectId: null
          }
        })
      }
      return
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(object as unknown as StripeSubscription, event.type.endsWith('.deleted') ? 'canceled' : undefined)
      return
    case 'invoice.paid': {
      const invoice = object as any
      const id = subscriptionId(invoice.subscription) || subscriptionId(invoice.parent?.subscription_details?.subscription)
      if (!id) return
      const subscription = await retrieveStripeSubscription(id)
      await syncSubscription(subscription)
      return
    }
    case 'invoice.payment_failed': {
      const invoice = object as any
      const id = subscriptionId(invoice.subscription) || subscriptionId(invoice.parent?.subscription_details?.subscription)
      if (!id) return
      const subscription = await retrieveStripeSubscription(id)
      await syncSubscription(subscription, 'past_due')
      return
    }
    default:
      return
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })

  const rawBody = await request.text()
  let event: StripeEvent
  try {
    if (!verifyStripeWebhookSignature(rawBody, signature, stripeWebhookSecret())) {
      return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 })
    }
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe webhook request' }, { status: 400 })
  }
  if (typeof event.livemode !== 'boolean' || event.livemode !== stripeIsLiveMode()) {
    return NextResponse.json({ error: 'Stripe event mode does not match this endpoint configuration.' }, { status: 400 })
  }

  const eventModel = (controlDb as any).stripeWebhookEvent
  const existing = await eventModel.findUnique({ where: { eventId: event.id } }).catch(() => null)
  if (existing?.status === 'PROCESSED') return NextResponse.json({ received: true })

  let claimed = false
  if (!existing) {
    try {
      await eventModel.create({ data: { eventId: event.id, eventType: event.type, status: 'PROCESSING' } })
      claimed = true
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002')) throw error
      const recovered = await eventModel.updateMany({
        where: { eventId: event.id, status: 'FAILED' },
        data: { status: 'PROCESSING', attempts: { increment: 1 }, error: null }
      })
      claimed = recovered.count === 1
    }
  } else if (existing.status === 'FAILED') {
    const recovered = await eventModel.updateMany({
      where: { eventId: event.id, status: 'FAILED' },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, error: null }
    })
    claimed = recovered.count === 1
  } else if (existing.status === 'PROCESSING' && Date.now() - new Date(existing.updatedAt).getTime() >= 5 * 60 * 1000) {
    const recovered = await eventModel.updateMany({
      where: { eventId: event.id, status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, error: null }
    })
    claimed = recovered.count === 1
  }
  if (!claimed) {
    return NextResponse.json({ error: 'Webhook event is already being processed; retry shortly.' }, { status: 503 })
  }

  try {
    await handleStripeEvent(event)
    await eventModel.update({ where: { eventId: event.id }, data: { status: 'PROCESSED', processedAt: new Date(), error: null } })
    return NextResponse.json({ received: true })
  } catch (error) {
    await eventModel.update({
      where: { eventId: event.id },
      data: { status: 'FAILED', error: error instanceof Error ? error.message.slice(0, 500) : 'Webhook handling failed' }
    }).catch(() => undefined)
    console.error('Stripe webhook processing failed:', event.type, error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
