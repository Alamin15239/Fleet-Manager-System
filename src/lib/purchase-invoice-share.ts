import { createHmac, timingSafeEqual } from 'node:crypto'

function getSigningSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

const SHARE_TOKEN_VERSION = 'v2'
const SHARE_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const SHARE_TOKEN_CLOCK_SKEW_SECONDS = 5 * 60

function createSignature(invoiceId: string, organizationSlug: string, issuedAt: number) {
  return createHmac('sha256', getSigningSecret())
    .update(`purchase-invoice-share:${organizationSlug}:${idName}:${issuedAt}`)
    .digest('base64url')
}

export function createPurchaseInvoiceShareToken(invoiceId: string, organizationSlug: string) {
  const issuedAt = Math.floor(Date.now() / 1000)
  return `${SHARE_TOKEN_VERSION}.${issuedAt}.${createSignature(invoiceId, organizationSlug, issuedAt)}`
}

export function verifyPurchaseInvoiceShareToken(invoiceId: string, organizationSlug: string, token: string) {
  try {
    const [version, issuedAtValue, providedSignature, ...extra] = token.split('.')
    if (version !== SHARE_TOKEN_VERSION || !issuedAtValue || !providedSignature || extra.length) return false
    if (!/^\\d{1,12}$/.test(issuedAtValue)) return false
    const issuedAt = Number(issuedAtValue)
    if (!Number.isSafeInteger(issuedAt)) return false
    const now = Math.floor(Date.now() / 1000)
    if (issuedAt > now + SHARE_TOKEN_CLOCK_SKEW_SECONDS || now - issuedAt > SHARE_TOKEN_MAX_AGE_SECONDS) return false
    const expected = Buffer.from(createSignature(invoiceId, organizationSlug, issuedAt))
    const received = Buffer.from(providedSignature)
    return expected.length === received.length && timingSafeEqual(expected, received)
  } catch {
    return false
  }
}
