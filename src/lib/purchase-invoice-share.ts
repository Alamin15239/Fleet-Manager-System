import { createHmac, timingSafeEqual } from 'node:crypto'

function getSigningSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

export function createPurchaseInvoiceShareToken(invoiceId: string, organizationSlug: string) {
  return createHmac('sha256', getSigningSecret())
    .update(`purchase-invoice-share:${organizationSlug}:${invoiceId}`)
    .digest('base64url')
}

export function verifyPurchaseInvoiceShareToken(invoiceId: string, organizationSlug: string, token: string) {
  try {
    const expected = Buffer.from(createPurchaseInvoiceShareToken(invoiceId, organizationSlug))
    const received = Buffer.from(token)
    return expected.length === received.length && timingSafeEqual(expected, received)
  } catch {
    return false
  }
}
