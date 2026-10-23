import { deflateRawSync, inflateRawSync } from 'node:zlib'
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface PurchaseInvoiceReportSharePayload {
  organizationSlug: string | null
  assetKeys: string[]
  search: string
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
  status: 'POSTED' | 'VOID' | 'ALL'
}

function getSigningSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

function normalizePayload(value: PurchaseInvoiceReportSharePayload): PurchaseInvoiceReportSharePayload {
  return {
    organizationSlug: typeof value.organizationSlug === 'string' ? value.organizationSlug.slice(0, 80) : null,
    assetKeys: Array.from(new Set(value.assetKeys.filter((key) => typeof key === 'string').map((key) => key.trim()).filter(Boolean))).slice(0, 500),
    search: String(value.search || '').trim().slice(0, 160),
    dateFrom: String(value.dateFrom || '').slice(0, 10),
    dateTo: String(value.dateTo || '').slice(0, 10),
    amountMin: String(value.amountMin || '').slice(0, 24),
    amountMax: String(value.amountMax || '').slice(0, 24),
    status: value.status === 'VOID' || value.status === 'ALL' ? value.status : 'POSTED',
  }
}

function signature(payload: string) {
  return createHmac('sha256', getSigningSecret()).update(`purchase-invoice-report-share:v1:${payload}`).digest('base64url')
}

export function createPurchaseInvoiceReportShareToken(input: PurchaseInvoiceReportSharePayload) {
  const payload = deflateRawSync(Buffer.from(JSON.stringify(normalizePayload(input)))).toString('base64url')
  return `v1.${payload}.${signature(payload)}`
}

export function verifyPurchaseInvoiceReportShareToken(token: string): PurchaseInvoiceReportSharePayload | null {
  try {
    const [version, payload, providedSignature, ...extra] = token.split('.')
    if (version !== 'v1' || !payload || !providedSignature || extra.length) return null
    const expected = Buffer.from(signature(payload))
    const received = Buffer.from(providedSignature)
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
    const decoded = JSON.parse(inflateRawSync(Buffer.from(payload, 'base64url'), { maxOutputLength: 64 * 1024 }).toString('utf8')) as Partial<PurchaseInvoiceReportSharePayload>
    if (!decoded || !Array.isArray(decoded.assetKeys) || !decoded.assetKeys.every((key) => typeof key === 'string')) return null
    return normalizePayload({
      organizationSlug: typeof decoded.organizationSlug === 'string' ? decoded.organizationSlug : null,
      assetKeys: decoded.assetKeys,
      search: typeof decoded.search === 'string' ? decoded.search : '',
      dateFrom: typeof decoded.dateFrom === 'string' ? decoded.dateFrom : '',
      dateTo: typeof decoded.dateTo === 'string' ? decoded.dateTo : '',
      amountMin: typeof decoded.amountMin === 'string' ? decoded.amountMin : '',
      amountMax: typeof decoded.amountMax === 'string' ? decoded.amountMax : '',
      status: decoded.status === 'VOID' || decoded.status === 'ALL' ? decoded.status : 'POSTED',
    })
  } catch {
    return null
  }
}
