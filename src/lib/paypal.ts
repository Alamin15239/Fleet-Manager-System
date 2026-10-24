export type PayPalBillingPeriod = 'MONTHLY' | 'YEARLY'

type PayPalOrder = {
  id: string
  status?: string
  intent?: string
  purchase_units?: Array<{
    custom_id?: string
    amount?: { value?: string; currency_code?: string }
    payments?: { captures?: Array<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string } }> }
  }>
  links?: Array<{ href?: string; rel?: string }>
}

type PayPalApiError = { message?: string; details?: Array<{ description?: string; issue?: string }> }

let accessTokenCache: { token: string; expiresAt: number } | null = null

function getPayPalEnvironment() {
  const environment = (process.env.PAYPAL_ENVIRONMENT || 'sandbox').trim().toLowerCase()
  if (environment !== 'sandbox') {
    throw new Error('Live PayPal payments are disabled. Set PAYPAL_ENVIRONMENT=sandbox for testing.')
  }
  return 'https://api-m.sandbox.paypal.com'
}

function getCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to the server environment.')
  }
  return { clientId, clientSecret }
}

function amountMinorFromEnv(key: string, fallback: number) {
  const raw = process.env[key]?.trim()
  const amount = raw ? Number(raw) : fallback
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw new Error(`${key} must be a positive USD amount.`)
  }
  return Math.round(amount * 100)
}

export function getPayPalPlanPrice(period: PayPalBillingPeriod) {
  return {
    currency: 'USD',
    amountMinor: period === 'MONTHLY'
      ? amountMinorFromEnv('PAYPAL_MONTHLY_PRICE_USD', 26.37)
      : amountMinorFromEnv('PAYPAL_YEARLY_PRICE_USD', 263.70)
  }
}

export function formatPayPalAmount(amountMinor: number) {
  return (amountMinor / 100).toFixed(2)
}

export async function getPayPalAccessToken() {
  const baseUrl = getPayPalEnvironment()
  const credentials = getCredentials()
  const now = Date.now()
  if (accessTokenCache && accessTokenCache.expiresAt > now + 30_000) return accessTokenCache.token

  const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store'
  })
  const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number }
  if (!response.ok || !payload.access_token) {
    accessTokenCache = null
    throw new Error('PayPal rejected the sandbox API credentials. Check that the API key and secret belong to the Sandbox app.')
  }
  accessTokenCache = {
    token: payload.access_token,
    expiresAt: now + Math.max(60, payload.expires_in || 300) * 1000
  }
  return payload.access_token
}

export async function paypalApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = getPayPalEnvironment()
  const token = await getPayPalAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: 'no-store' })
  const payload = await response.json().catch(() => ({})) as T & PayPalApiError
  if (!response.ok) {
    const detail = payload.details?.map((item) => item.description || item.issue).filter(Boolean).join('; ')
    const message = detail || payload.message || `PayPal API request failed (${response.status})`
    throw new Error(String(message).slice(0, 300))
  }
  return payload
}

export async function createPayPalOrder(input: {
  purchaseId: string
  period: PayPalBillingPeriod
  amountMinor: number
  currency: string
  returnUrl: string
  cancelUrl: string
}) {
  const amount = formatPayPalAmount(input.amountMinor)
  return paypalApi<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `fms-order-${input.purchaseId}`.slice(0, 38) },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: input.purchaseId,
        custom_id: input.purchaseId,
        invoice_id: `FMS-${input.purchaseId}`.slice(0, 127),
        description: `Fleet Manager ${input.period === 'MONTHLY' ? 'monthly' : 'annual'} prepaid access`,
        amount: { currency_code: input.currency, value: amount }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'Fleet Manager',
            locale: 'en-SA',
            landing_page: 'GUEST_CHECKOUT',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl
          }
        }
      }
    })
  })
}

export async function getPayPalOrder(orderId: string) {
  return paypalApi<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`)
}

export async function capturePayPalOrder(orderId: string, purchaseId: string) {
  const result = await paypalApi<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `fms-capture-${purchaseId}`.slice(0, 38) },
    body: '{}'
  })
  return result
}

export function getPayPalOrderCapture(order: PayPalOrder) {
  return order.purchase_units?.flatMap((unit) => unit.payments?.captures || []).find((capture) => capture.status === 'COMPLETED') || null
}