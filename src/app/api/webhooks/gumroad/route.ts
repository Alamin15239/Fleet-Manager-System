import { NextRequest, NextResponse } from 'next/server'
import { controlDb } from '@/lib/db'
import { provisionOrganization } from '@/lib/organization-provisioning'

export const runtime = 'nodejs'
export const maxDuration = 300

type GumroadSale = Record<string, unknown> & {
  id?: string
  sale_id?: string
  product_permalink?: string
  permalink?: string
  short_product_id?: string
  email?: string
  full_name?: string
  price?: number | string
  price_cents?: number | string
  currency?: string
  recurrence?: string
  subscription_id?: string
  created_at?: string
  sale_timestamp?: string
  refunded?: boolean | string
  disputed?: boolean | string
  chargebacked?: boolean | string
  subscription_ended_at?: string | null
  subscription_cancelled_at?: string | null
  subscription_failed_at?: string | null
  custom_fields?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
}

function isTrue(value: unknown): boolean {
  return value === true || value === 1 || (typeof value === 'string' && ['true', '1', 'yes'].includes(value.toLowerCase()))
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function customField(sale: GumroadSale, names: string[]): string {
  const wanted = new Set(names.map(normalizedKey))
  const fields = sale.custom_fields
  if (Array.isArray(fields)) {
    for (const item of fields) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (wanted.has(normalizedKey(text(record.name) || text(record.label)))) return text(record.value) || text(record.answer)
    }
  }
  if (fields && typeof fields === 'object') {
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      if (wanted.has(normalizedKey(key))) return text(value)
    }
  }
  return ''
}

function normalizedSlug(value: string): string {
  return value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

function getPlan(sale: GumroadSale): 'monthly' | 'yearly' | null {
  const recurrence = text(sale.recurrence).toLowerCase()
  if (['monthly', 'month'].includes(recurrence)) return 'monthly'
  if (['yearly', 'annual', 'annually', 'year'].includes(recurrence)) return 'yearly'
  return null
}

function addBillingPeriod(start: Date, plan: 'monthly' | 'yearly'): Date {
  const end = new Date(start)
  const day = end.getUTCDate()
  end.setUTCDate(1)
  if (plan === 'monthly') end.setUTCMonth(end.getUTCMonth() + 1)
  else end.setUTCFullYear(end.getUTCFullYear() + 1)
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(day, lastDay))
  return end
}

function configuredPermalink(): string {
  const configured = process.env.GUMROAD_PRODUCT_PERMALINK || 'ahdyo'
  try {
    const parsed = new URL(configured.includes('://') ? configured : `https://gumroad.com/l/${configured}`)
    return parsed.pathname.split('/').filter(Boolean).pop()?.toLowerCase() || configured.toLowerCase()
  } catch {
    return configured.trim().toLowerCase()
  }
}

function saleMatchesProduct(sale: GumroadSale): boolean {
  const expected = configuredPermalink()
  const candidates = [sale.product_permalink, sale.permalink, sale.short_product_id]
    .map(value => text(value).toLowerCase())
    .filter(Boolean)
  return candidates.some(candidate => {
    try {
      const parsed = new URL(candidate.includes('://') ? candidate : `https://gumroad.com/l/${candidate}`)
      return parsed.pathname.split('/').filter(Boolean).pop()?.toLowerCase() === expected
    } catch {
      return candidate === expected
    }
  })
}

async function getVerifiedSale(saleId: string): Promise<GumroadSale> {
  const accessToken = process.env.GUMROAD_ACCESS_TOKEN
  if (!accessToken) throw new Error('GUMROAD_ACCESS_TOKEN is not configured')

  const url = new URL(`https://api.gumroad.com/v2/sales/${encodeURIComponent(saleId)}`)
  url.searchParams.set('access_token', accessToken)
  const response = await fetch(url, { method: 'GET', cache: 'no-store' })
  if (!response.ok) throw new Error(`Gumroad API returned ${response.status}`)
  const payload = await response.json() as Record<string, unknown>
  if (payload.success !== true) throw new Error('Gumroad did not verify the sale')
  const sale = (payload.sale || payload.purchase || payload) as GumroadSale
  if (!sale || typeof sale !== 'object') throw new Error('Gumroad sale data is missing')
  return sale
}

type SaleState = { status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'REFUNDED' | 'DISPUTED'; periodEnd?: Date }

function saleState(sale: GumroadSale): SaleState {
  if (isTrue(sale.refunded)) return { status: 'REFUNDED' }
  if (isTrue(sale.disputed) || isTrue(sale.chargebacked)) return { status: 'DISPUTED' }
  if (sale.subscription_failed_at) {
    const end = new Date(sale.subscription_failed_at)
    return { status: 'PAST_DUE', ...(Number.isNaN(end.getTime()) ? {} : { periodEnd: end }) }
  }
  const endValue = text(sale.subscription_cancelled_at) || text(sale.subscription_ended_at)
  if (endValue) {
    const end = new Date(endValue)
    return { status: 'CANCELED', ...(Number.isNaN(end.getTime()) ? {} : { periodEnd: end }) }
  }
  return { status: 'ACTIVE' }
}

function saleAmount(sale: GumroadSale): number {
  const amount = Number(sale.price_cents ?? sale.price)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0
}

function saleCurrency(sale: GumroadSale): string {
  const currency = text(sale.currency).toUpperCase()
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD'
}

async function retryFailedProvisioning(organizationId: string) {
  const organization = await (controlDb as any).organization.findUnique({
    where: { id: organizationId },
    select: { status: true, updatedAt: true }
  })
  const staleProvisioning = organization?.status === 'PROVISIONING'
    && Date.now() - new Date(organization.updatedAt).getTime() > 5 * 60 * 1000
  if (organization?.status === 'FAILED' || staleProvisioning) {
    await provisionOrganization(organizationId)
  }
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error'
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[database connection]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[buyer email]')
    .replace(/(access_token[=:]\s*)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 240)
}

async function applyVerifiedSale(sale: GumroadSale, incomingSaleId: string) {
  if (!saleMatchesProduct(sale)) return { status: 'ignored', reason: 'unmatched_product' }
  if (isTrue(sale.test) && process.env.GUMROAD_ALLOW_TEST_SALES !== 'true') {
    return { status: 'ignored', reason: 'test_sale' }
  }

  const providerReference = `gumroad:${text(sale.id) || text(sale.sale_id) || incomingSaleId}`
  const subscriptionId = text(sale.subscription_id)
  const plan = getPlan(sale)
  const state = saleState(sale)
  const now = new Date()
  const start = new Date(text(sale.created_at) || text(sale.sale_timestamp) || now.toISOString())
  const periodStart = Number.isNaN(start.getTime()) ? now : start
  const periodEnd = state.periodEnd || (state.status === 'ACTIVE' && plan ? addBillingPeriod(now, plan) : undefined)
  const amountMinor = saleAmount(sale)
  const currency = saleCurrency(sale)

  const db = controlDb as any
  const priorPayment = await db.organizationBillingPayment.findUnique({ where: { providerReference } })
  if (priorPayment) {
    if (state.status !== 'ACTIVE') {
      const priorOrganization = await db.organization.findUnique({ where: { id: priorPayment.organizationId } })
      if (priorOrganization) {
        const resultingPeriodEnd = state.periodEnd || priorOrganization.billingCurrentPeriodEnd
        await db.$transaction(async (transaction: any) => {
          await transaction.organizationBillingPayment.update({
            where: { providerReference },
            data: {
              status: state.status,
              periodEnd: resultingPeriodEnd || null,
              failureReason: state.status === 'PAST_DUE' ? 'Gumroad reported a failed renewal.' : null
            }
          })
          await transaction.organization.update({
            where: { id: priorOrganization.id },
            data: {
              billingStatus: state.status,
              billingCurrentPeriodEnd: resultingPeriodEnd || null,
              billingCancelAtPeriodEnd: state.status === 'CANCELED'
            }
          })
        })
        return { status: 'updated' }
      }
    }
    await retryFailedProvisioning(priorPayment.organizationId)
    return { status: 'duplicate' }
  }

  const existingOrganization = subscriptionId
    ? await db.organization.findFirst({ where: { gumroadSubscriptionId: subscriptionId } })
    : null

  if (existingOrganization) {
    const resultingPeriodEnd = periodEnd || existingOrganization.billingCurrentPeriodEnd
    await db.$transaction(async (transaction: any) => {
      await transaction.organizationBillingPayment.create({
        data: {
          organizationId: existingOrganization.id,
          provider: 'GUMROAD',
          providerReference,
          kind: plan ? `${plan.toUpperCase()}_SUBSCRIPTION` : 'SUBSCRIPTION',
          amountMinor,
          currency,
          status: state.status,
          periodStart: state.status === 'ACTIVE' ? now : existingOrganization.billingCurrentPeriodStart,
          periodEnd: resultingPeriodEnd || null,
          failureReason: state.status === 'PAST_DUE' ? 'Gumroad reported a failed renewal.' : null
        }
      })
      await transaction.organization.update({
        where: { id: existingOrganization.id },
        data: {
          billingStatus: state.status,
          billingAmountMinor: amountMinor,
          billingCurrency: currency,
          billingCurrentPeriodStart: state.status === 'ACTIVE' ? now : existingOrganization.billingCurrentPeriodStart,
          billingCurrentPeriodEnd: resultingPeriodEnd || null,
          billingCancelAtPeriodEnd: state.status === 'CANCELED'
        }
      })
    })
    if (state.status === 'ACTIVE') await retryFailedProvisioning(existingOrganization.id)
    return { status: 'updated' }
  }

  // Refund, dispute, and renewal-failure notifications never create a workspace.
  if (state.status !== 'ACTIVE') return { status: 'ignored', reason: 'inactive_sale' }
  if (!subscriptionId || !plan || amountMinor <= 0) return { status: 'ignored', reason: 'not_a_paid_monthly_or_yearly_membership' }

  const name = customField(sale, ['Organization Name', 'Workspace Name', 'Company Name'])
  const requestedCode = customField(sale, ['Workspace Code', 'Organization Code', 'Workspace Login Code'])
  const slug = normalizedSlug(requestedCode || name)
  const email = text(sale.email).toLowerCase()
  const ownerName = customField(sale, ['Administrator Name', 'Admin Name']) || text(sale.full_name) || email
  if (name.length < 2 || slug.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Verified sale is missing organization name, workspace code, or buyer email')
  }

  const created = await db.$transaction(async (transaction: any) => {
    const organization = await transaction.organization.create({
      data: {
        name: name.slice(0, 80),
        slug,
        ownerName: ownerName.slice(0, 100),
        ownerEmail: email.slice(0, 254),
        status: 'PROVISIONING',
        schemaReady: false,
        isPrimary: false,
        billingProvider: 'GUMROAD',
        billingStatus: 'ACTIVE',
        billingAmountMinor: amountMinor,
        billingCurrency: currency,
        billingCurrentPeriodStart: periodStart,
        billingCurrentPeriodEnd: periodEnd,
        billingCancelAtPeriodEnd: false,
        billingConsentAt: now,
        billingConsentVersion: 'gumroad-membership-2026-10-24',
        gumroadSubscriptionId: subscriptionId
      }
    })
    await transaction.organizationBillingPayment.create({
      data: {
        organizationId: organization.id,
        provider: 'GUMROAD',
        providerReference,
        kind: `${plan.toUpperCase()}_SUBSCRIPTION`,
        amountMinor,
        currency,
        status: 'ACTIVE',
        periodStart,
        periodEnd
      }
    })
    return organization
  })

  await provisionOrganization(created.id)
  return { status: 'created' }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    if (rawBody.length > 32_000) return NextResponse.json({ error: 'Ping is too large.' }, { status: 413 })
    const form = new URLSearchParams(rawBody)
    const incomingSaleId = text(form.get('sale_id'))

    if (incomingSaleId.length > 256) return NextResponse.json({ error: 'Invalid sale id.' }, { status: 400 })
    // A dashboard ping can include the latest real sale even when Gumroad labels
    // the delivery as a test. Verify every supplied sale ID with Gumroad before
    // processing it; applyVerifiedSale still rejects actual test purchases.
    if (!incomingSaleId) {
      return NextResponse.json({ received: true, status: 'test_or_empty_ping' })
    }

    const sale = await getVerifiedSale(incomingSaleId)
    const result = await applyVerifiedSale(sale, incomingSaleId)
    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    // Avoid logging provider tokens, buyer details, or raw webhook bodies.
    console.error('[gumroad-ping] Sale processing failed:', safeErrorMessage(error))
    const status = error instanceof Error && error.message === 'GUMROAD_ACCESS_TOKEN is not configured' ? 503 : 500
    return NextResponse.json({ error: status === 503 ? 'Gumroad sale verification is not configured.' : 'Gumroad sale could not be processed.' }, { status })
  }
}
