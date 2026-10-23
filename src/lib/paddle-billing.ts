import { createHmac, timingSafeEqual } from 'node:crypto'
import { controlDb } from '@/lib/db'
import { provisionOrganization } from '@/lib/organization-provisioning'

const PADDLE_VERSION = '1'

export type PaddlePrice = {
  id: string
  status: string
  unit_price?: { amount?: string; currency_code?: string }
  billing_cycle?: { interval?: string; frequency?: number } | null
}

function paddleApiBase() {
  if (process.env.PADDLE_ENVIRONMENT?.trim().toLowerCase() !== 'sandbox') {
    throw new Error('Paddle live billing is disabled until account verification is approved.')
  }
  return 'https://sandbox-api.paddle.com'
}

export function paddleEnvironment() {
  return process.env.PADDLE_ENVIRONMENT?.trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production'
}

export function isPaddleBillingReady() {
  const environment = process.env.PADDLE_ENVIRONMENT?.trim().toLowerCase()
  const clientToken = process.env.PADDLE_CLIENT_TOKEN?.trim()

  return Boolean(
    environment === 'sandbox' &&
    clientToken?.startsWith('test_') &&
    process.env.PADDLE_API_KEY?.trim() &&
    process.env.PADDLE_PRICE_ID?.trim() &&
    process.env.PADDLE_WEBHOOK_SECRET?.trim()
  )
}

export async function paddleApiRequest(path: string, method = 'GET', body?: Record<string, unknown>) {
  const key = process.env.PADDLE_API_KEY?.trim()
  if (!key) throw new Error('Paddle API credentials are not configured.')
  const response = await fetch(`${paddleApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Paddle-Version': PADDLE_VERSION
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  })
  const payload = await response.json().catch(() => ({})) as Record<string, any>
  if (!response.ok) {
    const message = typeof payload.error?.detail === 'string'
      ? payload.error.detail
      : typeof payload.error?.type === 'string' ? payload.error.type : ''
    throw new Error(message || `Paddle request failed (${response.status}).`)
  }
  return payload
}

export async function getConfiguredPaddlePrice(): Promise<PaddlePrice> {
  const id = process.env.PADDLE_PRICE_ID?.trim()
  if (!id || !/^pri_[a-z\d]{26}$/i.test(id)) throw new Error('Configure a valid Paddle annual price ID.')
  const result = await paddleApiRequest(`/prices/${encodeURIComponent(id)}`)
  const price = result.data as PaddlePrice | undefined
  if (!price || price.id !== id || price.status !== 'active') throw new Error('The configured Paddle price is unavailable or inactive.')
  if (price.billing_cycle?.interval !== 'year' || price.billing_cycle?.frequency !== 1) {
    throw new Error('The Paddle price must be a recurring annual price billed every year.')
  }
  const amount = Number(price.unit_price?.amount)
  if (!Number.isSafeInteger(amount) || amount <= 0 || !price.unit_price?.currency_code) {
    throw new Error('Paddle returned invalid annual price details.')
  }
  return price
}

export function verifyPaddleWebhook(rawBody: string, suppliedSignature: string | null) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim()
  if (!secret || !suppliedSignature) return false
  const fields = suppliedSignature.split(';').map((part) => part.trim().split('=', 2))
  const timestamp = fields.find(([key]) => key === 'ts')?.[1]
  const signatures = fields.filter(([key]) => key === 'h1').map(([, value]) => value).filter(Boolean)
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false
  const timestampMs = Number(timestamp) * 1000
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest()
  return signatures.some((signature) => {
    if (!/^[a-f\d]{64}$/i.test(signature)) return false
    const received = Buffer.from(signature, 'hex')
    return received.length === expected.length && timingSafeEqual(received, expected)
  })
}

function asDate(value: unknown) {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function addYear(start: Date) {
  const end = new Date(start)
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  return end
}

async function findPaddleOrganization(data: any) {
  const organizationId = typeof data?.custom_data?.organizationId === 'string' ? data.custom_data.organizationId : null
  const subscriptionId = typeof data?.id === 'string' && data.id.startsWith('sub_')
    ? data.id
    : typeof data?.subscription_id === 'string' ? data.subscription_id : null
  if (organizationId) {
    const organization = await (controlDb as any).organization.findUnique({ where: { id: organizationId } })
    if (organization) return organization
  }
  if (subscriptionId) return await (controlDb as any).organization.findUnique({ where: { paddleSubscriptionId: subscriptionId } })
  return null
}

async function applySubscriptionEvent(eventType: string, subscription: any) {
  if (!subscription?.id || typeof subscription.id !== 'string') throw new Error('Paddle subscription ID is missing.')
  const organization = await findPaddleOrganization(subscription)
  if (!organization || organization.billingProvider !== 'PADDLE') return { ignored: true }

  const currentPeriod = subscription.current_billing_period
  const startsAt = asDate(currentPeriod?.starts_at) || organization.billingCurrentPeriodStart
  const endsAt = asDate(currentPeriod?.ends_at) || organization.billingCurrentPeriodEnd
  const scheduledCancel = subscription.scheduled_change?.action === 'cancel'
  const providerStatus = String(subscription.status || '').toLowerCase()
  const data: Record<string, unknown> = {
    paddleSubscriptionId: subscription.id,
    paddleCustomerId: subscription.customer_id || organization.paddleCustomerId,
    paddlePriceId: subscription.items?.find((item: any) => item?.price_id)?.price_id || organization.paddlePriceId,
    billingCurrentPeriodStart: startsAt,
    billingCurrentPeriodEnd: endsAt,
    billingCancelAtPeriodEnd: scheduledCancel
  }

  if (providerStatus === 'canceled' || eventType === 'subscription.canceled') {
    data.billingStatus = 'EXPIRED'
    data.billingCancelAtPeriodEnd = true
    data.billingGraceUntil = null
  } else if (providerStatus === 'past_due') {
    data.billingStatus = 'PAST_DUE'
    data.billingGraceUntil = endsAt ? new Date(endsAt.getTime() + 7 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  } else if (scheduledCancel && organization.billingStatus === 'ACTIVE') {
    data.billingStatus = 'CANCEL_AT_PERIOD_END'
  } else if (!scheduledCancel && organization.billingStatus === 'CANCEL_AT_PERIOD_END') {
    data.billingStatus = 'ACTIVE'
  }

  await (controlDb as any).organization.update({ where: { id: organization.id }, data })
  return { updated: true, organizationId: organization.id }
}

async function applyCompletedTransaction(transaction: any) {
  if (!transaction?.id || transaction.status !== 'completed') return { ignored: true }
  const configuredPriceId = process.env.PADDLE_PRICE_ID?.trim()
  const includedPrice = Array.isArray(transaction.items) && transaction.items.some((item: any) =>
    item?.price?.id === configuredPriceId || item?.price_id === configuredPriceId
  )
  if (!configuredPriceId || !includedPrice) throw new Error('Paddle transaction does not include the configured annual price.')

  const organization = await findPaddleOrganization(transaction)
  if (!organization || organization.billingProvider !== 'PADDLE') throw new Error('The organization for this Paddle transaction was not found.')
  const paymentModel = (controlDb as any).organizationBillingPayment
  const existing = await paymentModel.findUnique({ where: { providerReference: transaction.id }, select: { status: true } })
  if (existing?.status === 'CAPTURED') {
    if (organization.status !== 'ACTIVE' && organization.billingStatus === 'ACTIVE') await provisionOrganization(organization.id)
    return { duplicate: true, organizationId: organization.id }
  }

  const isInitial = organization.billingStatus === 'PENDING_PAYMENT'
  const attemptId = typeof transaction.custom_data?.attemptId === 'string' ? transaction.custom_data.attemptId : null
  if (isInitial && (!attemptId || organization.billingAttemptId !== attemptId)) {
    throw new Error('This Paddle checkout belongs to an expired organization purchase attempt.')
  }
  if (!isInitial && !['ACTIVE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END'].includes(organization.billingStatus || '')) {
    throw new Error('Paddle payment arrived for an unexpected subscription state.')
  }
  if (!transaction.subscription_id) throw new Error('Paddle did not attach a subscription to the completed annual transaction.')
  if (organization.paddleSubscriptionId && organization.paddleSubscriptionId !== transaction.subscription_id) {
    throw new Error('Paddle subscription does not match this organization.')
  }

  const currency = String(transaction.currency_code || '').toUpperCase()
  // Paddle may localize checkout currency for the buyer. Persist the actual
  // captured currency instead of rejecting a valid converted transaction.
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Paddle transaction currency is invalid.')
  const total = Number(transaction.details?.totals?.total)
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('Paddle transaction total is invalid.')

  const now = new Date()
  const periodStart = asDate(transaction.billing_period?.starts_at) || (organization.billingCurrentPeriodEnd && organization.billingCurrentPeriodEnd > now ? organization.billingCurrentPeriodEnd : now)
  const periodEnd = asDate(transaction.billing_period?.ends_at) || addYear(periodStart)
  const kind = isInitial ? 'INITIAL' : 'RENEWAL'
  const payment = {
    organizationId: organization.id,
    provider: 'PADDLE',
    providerReference: transaction.id,
    kind,
    amountMinor: total,
    currency,
    status: 'CAPTURED',
    periodStart,
    periodEnd
  }

  await (controlDb as any).$transaction(async (tx: any) => {
    const claimed = await tx.organizationBillingPayment.createMany({ data: [payment], skipDuplicates: true })
    if (!claimed.count) return
    const changed = await tx.organization.updateMany({
      where: isInitial
        ? { id: organization.id, billingProvider: 'PADDLE', billingStatus: 'PENDING_PAYMENT', billingAttemptId: attemptId }
        : { id: organization.id, billingProvider: 'PADDLE', paddleSubscriptionId: organization.paddleSubscriptionId || transaction.subscription_id },
      data: {
        billingStatus: 'ACTIVE',
        billingAmountMinor: total,
        billingCurrency: currency,
        billingCurrentPeriodStart: periodStart,
        billingCurrentPeriodEnd: periodEnd,
        billingGraceUntil: null,
        billingCancelAtPeriodEnd: false,
        billingAttemptId: null,
        billingLastAttemptAt: null,
        paddleSubscriptionId: transaction.subscription_id,
        paddleCustomerId: transaction.customer_id || organization.paddleCustomerId,
        paddlePriceId: configuredPriceId
      }
    })
    if (!changed.count) throw new Error('This Paddle payment has already been applied to a different subscription state.')
  })

  if (isInitial) await provisionOrganization(organization.id)
  return { captured: true, organizationId: organization.id, periodEnd }
}

export async function applyPaddleWebhookEvent(eventType: string, data: any) {
  if (eventType === 'transaction.completed') return await applyCompletedTransaction(data)
  if (eventType === 'subscription.created' || eventType === 'subscription.updated' || eventType === 'subscription.canceled') {
    return await applySubscriptionEvent(eventType, data)
  }
  return { ignored: true }
}

export async function updatePaddleSubscriptionRenewal(subscriptionId: string, action: 'cancel' | 'resume') {
  if (action === 'cancel') {
    const result = await paddleApiRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, 'POST', { effective_from: 'next_billing_period' })
    return result.data
  }
  const result = await paddleApiRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}`, 'PATCH', { scheduled_change: null })
  return result.data
}

export async function expireEndedPaddleSubscriptions(now = new Date()) {
  const organizationModel = (controlDb as any).organization
  const expiredCancellation = await organizationModel.updateMany({
    where: {
      status: 'ACTIVE',
      billingProvider: 'PADDLE',
      billingStatus: 'CANCEL_AT_PERIOD_END',
      billingCancelAtPeriodEnd: true,
      billingCurrentPeriodEnd: { lte: now }
    },
    data: { billingStatus: 'EXPIRED', billingGraceUntil: null }
  })
  const expiredGrace = await organizationModel.updateMany({
    where: {
      status: 'ACTIVE',
      billingProvider: 'PADDLE',
      billingStatus: 'PAST_DUE',
      billingGraceUntil: { lte: now }
    },
    data: { billingStatus: 'EXPIRED' }
  })
  return expiredCancellation.count + expiredGrace.count
}
