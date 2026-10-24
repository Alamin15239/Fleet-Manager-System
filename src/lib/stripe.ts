import { createHmac, timingSafeEqual } from 'node:crypto'

const STRIPE_API = 'https://api.stripe.com/v1'

export type StripePrice = {
  id: string
  active: boolean
  currency: string
  unit_amount: number | null
  recurring: { interval: string; interval_count: number } | null
}

export type StripeSubscription = {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  current_period_start: number
  current_period_end: number
  metadata?: Record<string, string>
  items?: { data: Array<{ price?: { id: string; unit_amount: number | null; currency: string } }> }
}

export type StripeCheckoutSession = {
  id: string
  url: string | null
  status: string | null
  payment_status: string
  amount_total: number | null
  currency: string | null
  customer: string | null
  subscription: string | StripeSubscription | null
  client_reference_id: string | null
  metadata?: Record<string, string>
}

export type StripeEvent = {
  id: string
  type: string
  livemode: boolean
  data: { object: Record<string, any> }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export function stripeMode(): 'test' | 'live' {
  const mode = process.env.STRIPE_MODE?.trim()
  if (mode !== 'test' && mode !== 'live') throw new Error('STRIPE_MODE must be set to test or live.')
  return mode
}

export function stripeIsLiveMode() {
  return stripeMode() === 'live'
}

function stripeSecretKey() {
  const mode = stripeMode()
  const key = requiredEnv('STRIPE_SECRET_KEY')
  const expectedPrefix = mode === 'live' ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/
  if (!expectedPrefix.test(key)) throw new Error(`A Stripe ${mode}-mode secret key is required.`)
  return key
}

async function stripeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...init.headers
    },
    cache: 'no-store'
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string; type?: string } }
  if (!response.ok) {
    const stripeMessage = payload.error?.message
    throw new Error(stripeMessage ? `Stripe request failed: ${stripeMessage}` : `Stripe request failed (${response.status})`)
  }
  return payload
}

export async function retrieveAnnualStripePrice(): Promise<StripePrice> {
  const priceId = requiredEnv('STRIPE_PRICE_ID')
  const price = await stripeRequest<StripePrice>(`/prices/${encodeURIComponent(priceId)}`)
  if (!price.active || !price.recurring || price.recurring.interval !== 'year' || price.recurring.interval_count !== 1) {
    throw new Error('The configured Stripe price must be active and billed once per year.')
  }
  if (price.unit_amount === null || !Number.isInteger(price.unit_amount) || price.unit_amount <= 0) {
    throw new Error('The configured Stripe price must have a fixed positive amount.')
  }
  return price
}

export async function createStripeOrganizationCheckout(input: {
  organizationId: string
  organizationName: string
  slug: string
  billingAttemptId: string
  ownerName: string
  ownerEmail: string
  appUrl: string
  idempotencyKey: string
}) {
  const price = await retrieveAnnualStripePrice()
  const form = new URLSearchParams()
  form.set('mode', 'subscription')
  form.set('line_items[0][price]', price.id)
  form.set('line_items[0][quantity]', '1')
  form.set('customer_email', input.ownerEmail)
  form.set('client_reference_id', input.organizationId)
  form.set('metadata[organizationId]', input.organizationId)
  form.set('metadata[organizationSlug]', input.slug)
  form.set('metadata[billingAttemptId]', input.billingAttemptId)
  form.set('subscription_data[metadata][organizationId]', input.organizationId)
  form.set('subscription_data[metadata][organizationSlug]', input.slug)
  form.set('subscription_data[metadata][billingAttemptId]', input.billingAttemptId)
  form.set('success_url', `${input.appUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`)
  form.set('cancel_url', `${input.appUrl}/purchase?cancelled=1`)

  return stripeRequest<StripeCheckoutSession>('/checkout/sessions', {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: form.toString()
  })
}

export async function createStripePortalSession(customerId: string, returnUrl: string) {
  const form = new URLSearchParams({ customer: customerId, return_url: returnUrl })
  return stripeRequest<{ url: string }>('/billing_portal/sessions', { method: 'POST', body: form.toString() })
}

export async function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
}

export function verifyStripeWebhookSignature(rawBody: string, headerValue: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const pieces = headerValue.split(',').map((piece) => piece.trim().split('=', 2))
  const timestamp = pieces.find(([key]) => key === 't')?.[1]
  const signatures = pieces.filter(([key]) => key === 'v1').map(([, value]) => value).filter(Boolean)
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest()
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false
    const received = Buffer.from(signature, 'hex')
    return received.length === expected.length && timingSafeEqual(received, expected)
  })
}

export function stripeWebhookSecret() {
  stripeMode()
  return requiredEnv('STRIPE_WEBHOOK_SECRET')
}

export function appBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://fleetmaintenance.site'
  const url = new URL(configured)
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS in production.')
  }
  return url.origin
}
