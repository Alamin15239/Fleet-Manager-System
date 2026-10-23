import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { controlDb } from '@/lib/db'
import { provisionOrganization } from '@/lib/organization-provisioning'

const TAP_API = 'https://api.tap.company/v2'

export type TapCharge = {
  id?: string
  status?: string
  amount?: number | string
  currency?: string
  metadata?: Record<string, string>
  reference?: { order?: string; gateway?: string; payment?: string }
  transaction?: { created?: string }
  customer?: { id?: string }
  card?: { id?: string; brand?: string; last_four?: string }
  payment_agreement?: { id?: string; type?: string; contract?: { id?: string; customer_id?: string } }
}

export const ORGANIZATION_BILLING_CONSENT_VERSION = '2026-10-24-v1'

export function annualOrganizationPriceSar() {
  const configured = Number(process.env.ORGANIZATION_ANNUAL_PRICE_SAR || 4_800)
  return Number.isFinite(configured) && configured >= 100 ? Math.round(configured) : 4_800
}

export function isTapBillingReady() {
  return Boolean(process.env.TAP_SECRET_KEY?.trim()) && process.env.TAP_RECURRING_ENABLED === 'true'
}

async function tapRequest(path: string, body?: Record<string, unknown>) {
  const secret = process.env.TAP_SECRET_KEY?.trim()
  if (!secret) throw new Error('Tap payments are not configured.')
  const response = await fetch(`${TAP_API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      lang_code: 'EN'
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  })
  const payload = await response.json().catch(() => ({})) as Record<string, any>
  if (!response.ok) {
    const message = Array.isArray(payload.errors)
      ? payload.errors.map((item: any) => item.description).filter(Boolean).join(' ')
      : typeof payload.message === 'string' ? payload.message : ''
    throw new Error(message || `Tap payment request failed (${response.status}).`)
  }
  return payload
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { first_name: parts[0] || 'Fleet', last_name: parts.slice(1).join(' ') || 'Administrator' }
}

function phoneParts(countryCode: string, phone: string) {
  const cleanCode = countryCode.replace(/\D/g, '')
  const cleanPhone = phone.replace(/\D/g, '')
  if (cleanCode.length < 1 || cleanCode.length > 3 || cleanPhone.length < 7 || cleanPhone.length > 14) {
    throw new Error('Enter a valid phone number and country calling code for card renewal.')
  }
  return { country_code: Number(cleanCode), number: cleanPhone }
}

export async function createTapInitialCharge(input: {
  organizationId: string
  attemptId: string
  name: string
  email: string
  countryCode: string
  phone: string
  origin: string
}) {
  const name = splitName(input.name)
  const amount = annualOrganizationPriceSar()
  const payload: Record<string, unknown> = {
    amount,
    currency: 'SAR',
    customer_initiated: true,
    threeDSecure: true,
    save_card: true,
    payment_agreement: { type: 'UNSCHEDULED' },
    description: 'Fleet Manager Pro annual organization subscription',
    statement_descriptor: 'FLEET MANAGER',
    metadata: {
      udf1: input.organizationId,
      udf2: 'annual-initial',
      udf3: input.attemptId
    },
    reference: {
      transaction: `org-${input.organizationId.slice(-12)}-${input.attemptId.slice(0, 8)}`,
      order: input.organizationId
    },
    customer: {
      ...name,
      email: input.email,
      phone: phoneParts(input.countryCode, input.phone)
    },
    source: { id: 'src_card' },
    post: { url: `${input.origin.replace(/\/$/, '')}/api/webhooks/tap` },
    redirect: { url: `${input.origin.replace(/\/$/, '')}/purchase/complete?org=${encodeURIComponent(input.organizationId)}` }
  }
  if (process.env.TAP_MERCHANT_ID?.trim()) payload.merchant = { id: process.env.TAP_MERCHANT_ID.trim() }
  return await tapRequest('/charges/', payload) as TapCharge & { transaction?: { url?: string } }
}

export function verifyTapWebhook(charge: TapCharge, suppliedHash: string | null) {
  const secret = process.env.TAP_SECRET_KEY?.trim()
  if (!secret || !suppliedHash || !charge.id || charge.amount === undefined || !charge.currency || !charge.status) return false
  const amount = Number(charge.amount)
  if (!Number.isFinite(amount)) return false
  const amountText = charge.currency === 'KWD' || charge.currency === 'BHD' || charge.currency === 'OMR' || charge.currency === 'JOD'
    ? amount.toFixed(3)
    : amount.toFixed(2)
  const values = `x_id${charge.id}x_amount${amountText}x_currency${charge.currency}x_gateway_reference${charge.reference?.gateway || ''}x_payment_reference${charge.reference?.payment || ''}x_status${charge.status}x_created${charge.transaction?.created || ''}`
  const expected = createHmac('sha256', secret).update(values).digest()
  let received: Buffer
  try { received = Buffer.from(suppliedHash.trim(), 'hex') } catch { return false }
  return received.length === expected.length && timingSafeEqual(received, expected)
}

function nextAnnualPeriod(previousEnd?: Date | null) {
  const now = new Date()
  const start = previousEnd && previousEnd.getTime() > now.getTime() ? previousEnd : now
  const end = new Date(start)
  end.setUTCFullYear(end.getUTCFullYear() + 1)
  return { start, end }
}

export async function applyTapCharge(charge: TapCharge) {
  if (!charge.id) throw new Error('Tap payment reference is missing.')
  const organizationId = charge.metadata?.udf1 || charge.reference?.order
  const attemptId = charge.metadata?.udf3
  const kind = charge.metadata?.udf2 === 'annual-renewal' ? 'RENEWAL' : 'INITIAL'
  if (!organizationId || !attemptId) throw new Error('Tap payment does not match an organization checkout.')

  const organizationModel = (controlDb as any).organization
  const paymentModel = (controlDb as any).organizationBillingPayment
  const organization = await organizationModel.findUnique({ where: { id: organizationId } })
  if (!organization || organization.billingProvider !== 'TAP') throw new Error('The billed organization was not found.')

  const existing = await paymentModel.findUnique({ where: { providerReference: charge.id }, select: { id: true, status: true } })
  if (existing?.status === 'CAPTURED') {
    if (organization.billingStatus === 'ACTIVE' && ['PROVISIONING', 'FAILED'].includes(organization.status)) {
      if (organization.status === 'FAILED') await organizationModel.update({ where: { id: organization.id }, data: { status: 'PROVISIONING', failureReason: null } })
      await provisionOrganization(organization.id)
    }
    return { duplicate: true, organizationId }
  }
  if (organization.billingAttemptId !== attemptId) throw new Error('This Tap payment belongs to an expired checkout attempt.')

  const expectedAmount = organization.billingAmountMinor ?? annualOrganizationPriceSar() * 100
  const receivedAmount = Math.round(Number(charge.amount) * 100)
  if (charge.currency !== 'SAR' || receivedAmount !== expectedAmount) throw new Error('Tap payment amount or currency did not match the annual plan.')

  const chargeStatus = charge.status?.toUpperCase().replace(/[_-]+/g, ' ') || 'UNKNOWN'
  const captured = chargeStatus === 'CAPTURED'
  const period = kind === 'RENEWAL' ? nextAnnualPeriod(organization.billingCurrentPeriodEnd) : nextAnnualPeriod(null)
  const now = new Date()

  if (!captured) {
    const isInitialPending = kind === 'INITIAL' && organization.billingStatus === 'PENDING_PAYMENT'
    const isRenewalPending = kind === 'RENEWAL' && ['ACTIVE', 'PAST_DUE'].includes(organization.billingStatus)
    if (!isInitialPending && !isRenewalPending) return { ignored: true, organizationId }
    if (['INITIATED', 'IN PROGRESS', 'UNKNOWN'].includes(chargeStatus)) return { pending: true, organizationId }

    await paymentModel.upsert({
      where: { providerReference: charge.id },
      create: {
        organizationId,
        provider: 'TAP',
        providerReference: charge.id,
        kind,
        amountMinor: expectedAmount,
        currency: 'SAR',
        status: chargeStatus,
        failureReason: 'Payment was not captured.'
      },
      update: { status: chargeStatus, failureReason: 'Payment was not captured.' }
    })
    await organizationModel.update({
      where: { id: organizationId },
      data: kind === 'INITIAL'
        ? { billingStatus: 'PAYMENT_FAILED', billingAttemptId: null, tapPendingChargeId: null, tapRenewalLockUntil: null }
        : {
            billingStatus: 'PAST_DUE',
            billingGraceUntil: organization.billingCurrentPeriodEnd
              ? new Date(organization.billingCurrentPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
              : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            billingLastAttemptAt: now,
            billingAttemptId: null,
            tapPendingChargeId: null,
            tapRenewalLockUntil: null
          }
    })
    return { failed: true, organizationId }
  }

  const isInitialPending = kind === 'INITIAL' && organization.billingStatus === 'PENDING_PAYMENT'
  const isRenewalPending = kind === 'RENEWAL' && ['ACTIVE', 'PAST_DUE'].includes(organization.billingStatus)
  if (!isInitialPending && !isRenewalPending) throw new Error('Tap payment arrived for an unexpected subscription state.')

  await (controlDb as any).$transaction(async (tx: any) => {
    const changed = await tx.organization.updateMany({
      where: { id: organizationId, billingAttemptId: attemptId },
      data: {
        billingStatus: 'ACTIVE',
        billingCurrentPeriodStart: period.start,
        billingCurrentPeriodEnd: period.end,
        billingGraceUntil: null,
        billingCancelAtPeriodEnd: false,
        billingLastAttemptAt: null,
        billingAttemptId: null,
        tapPendingChargeId: null,
        tapRenewalLockUntil: null,
        tapCustomerId: charge.customer?.id || organization.tapCustomerId,
        tapCardId: charge.card?.id || organization.tapCardId,
        tapCardBrand: charge.card?.brand || organization.tapCardBrand,
        tapCardLast4: charge.card?.last_four || organization.tapCardLast4,
        tapPaymentAgreementId: charge.payment_agreement?.id || organization.tapPaymentAgreementId
      }
    })
    if (!changed.count) throw new Error('This payment attempt has already been processed.')
    if (!changed.count) {
      const concurrentlyProcessed = await tx.organizationBillingPayment.findUnique({
        where: { providerReference: charge.id },
        select: { status: true }
      })
      if (concurrentlyProcessed?.status !== 'CAPTURED') throw new Error('This payment attempt has already been processed.')
      return
    }
    await tx.organizationBillingPayment.upsert({
      where: { providerReference: charge.id },
      create: {
        organizationId,
        provider: 'TAP',
        providerReference: charge.id,
        kind,
        amountMinor: expectedAmount,
        currency: 'SAR',
        status: 'CAPTURED',
        periodStart: period.start,
        periodEnd: period.end
      },
      update: {
        status: 'CAPTURED',
        failureReason: null,
        periodStart: period.start,
        periodEnd: period.end
      }
    })
  })

  if (kind === 'INITIAL') await provisionOrganization(organizationId)
  return { captured: true, organizationId, periodEnd: period.end }
}

export async function renewDueOrganizationSubscriptions(now = new Date()) {
  const organizationModel = (controlDb as any).organization
  const paymentModel = (controlDb as any).organizationBillingPayment
  const expireBefore = now
  const renewalCutoff = now
  const expired = await organizationModel.findMany({
    where: {
      status: 'ACTIVE',
      billingProvider: 'TAP',
      OR: [
        { billingStatus: 'CANCEL_AT_PERIOD_END', billingCurrentPeriodEnd: { lte: expireBefore } },
        { billingStatus: 'PAST_DUE', billingGraceUntil: { lte: expireBefore } }
      ]
    },
    select: { id: true }
  })
  if (expired.length) await organizationModel.updateMany({
    where: { id: { in: expired.map((item: any) => item.id) } },
    data: { billingStatus: 'EXPIRED', status: 'ACTIVE' }
  })

  const renewalMethodMissing = await organizationModel.findMany({
    where: {
      status: 'ACTIVE',
      billingProvider: 'TAP',
      billingStatus: 'ACTIVE',
      billingCancelAtPeriodEnd: false,
      billingCurrentPeriodEnd: { lte: renewalCutoff },
      OR: [{ tapCardId: null }, { tapCustomerId: null }, { tapPaymentAgreementId: null }]
    },
    select: { id: true, billingCurrentPeriodEnd: true }
  })
  for (const organization of renewalMethodMissing) {
    await organizationModel.update({
      where: { id: organization.id },
      data: {
        billingStatus: 'PAST_DUE',
        billingGraceUntil: new Date((organization.billingCurrentPeriodEnd || now).getTime() + 7 * 24 * 60 * 60 * 1000)
      }
    })
  }

  const pendingRenewals = await organizationModel.findMany({
    where: {
      status: 'ACTIVE',
      billingProvider: 'TAP',
      tapPendingChargeId: { not: null },
      tapRenewalLockUntil: { lte: now }
    },
    select: { id: true, billingAttemptId: true, tapPendingChargeId: true }
  })
  let reconciled = 0
  const errors: Array<{ organizationId: string; message: string }> = []
  for (const organization of pendingRenewals) {
    if (!organization.billingAttemptId || !organization.tapPendingChargeId) continue
    try {
      const charge = await tapRequest(`/charges/${encodeURIComponent(organization.tapPendingChargeId)}`) as TapCharge
      const result = await applyTapCharge({
        ...charge,
        metadata: {
          ...charge.metadata,
          udf1: organization.id,
          udf2: 'annual-renewal',
          udf3: organization.billingAttemptId
        }
      })
      if ('captured' in result || 'failed' in result) reconciled++
    } catch (error) {
      errors.push({ organizationId: organization.id, message: error instanceof Error ? error.message : 'Could not reconcile the pending Tap charge.' })
    }
  }

  const retryBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const candidates = await organizationModel.findMany({
    where: {
      status: 'ACTIVE',
      billingProvider: 'TAP',
      billingStatus: { in: ['ACTIVE', 'PAST_DUE'] },
      billingCancelAtPeriodEnd: false,
      billingCurrentPeriodEnd: { lte: renewalCutoff },
      tapCardId: { not: null },
      tapCustomerId: { not: null },
      tapPaymentAgreementId: { not: null },
      tapPendingChargeId: null,
      OR: [
        { billingLastAttemptAt: null },
        { billingLastAttemptAt: { lte: retryBefore } }
      ]
    },
    orderBy: { billingCurrentPeriodEnd: 'asc' }
  })

  let captured = 0
  let initiated = 0
  let failed = 0
  for (const organization of candidates) {
    const attemptId = randomUUID()
    const lockUntil = new Date(now.getTime() + 10 * 60 * 1000)
    const claim = await organizationModel.updateMany({
      where: {
        id: organization.id,
        billingAttemptId: null,
        tapPendingChargeId: null,
        OR: [{ tapRenewalLockUntil: null }, { tapRenewalLockUntil: { lte: now } }]
      },
      data: { billingAttemptId: attemptId, tapRenewalLockUntil: lockUntil, billingLastAttemptAt: now }
    })
    if (!claim.count) continue
    try {
      const token = await tapRequest('/tokens/', {
        saved_card: { card_id: organization.tapCardId, customer_id: organization.tapCustomerId }
      })
      if (!token.id) throw new Error('Tap could not create a renewal token for the saved payment method.')
      const payload: Record<string, unknown> = {
        amount: (organization.billingAmountMinor || annualOrganizationPriceSar() * 100) / 100,
        currency: organization.billingCurrency || 'SAR',
        customer_initiated: false,
        threeDSecure: false,
        save_card: false,
        payment_agreement: { id: organization.tapPaymentAgreementId },
        description: 'Fleet Manager Pro annual subscription renewal',
        metadata: { udf1: organization.id, udf2: 'annual-renewal', udf3: attemptId },
        reference: {
          transaction: `renew-${organization.id.slice(-12)}-${attemptId.slice(0, 8)}`,
          order: organization.id
        },
        customer: { id: organization.tapCustomerId },
        source: { id: token.id },
        post: { url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://fleetmaintenance.site').replace(/\/$/, '')}/api/webhooks/tap` },
        redirect: { url: `${(process.env.NEXT_PUBLIC_APP_URL || 'https://fleetmaintenance.site').replace(/\/$/, '')}/purchase/complete?org=${encodeURIComponent(organization.id)}` }
      }
      if (process.env.TAP_MERCHANT_ID?.trim()) payload.merchant = { id: process.env.TAP_MERCHANT_ID.trim() }
      const charge = await tapRequest('/charges/', payload) as TapCharge
      if (!charge.id) throw new Error('Tap did not return a renewal charge reference.')
      await organizationModel.updateMany({
        where: { id: organization.id, billingAttemptId: attemptId },
        data: { tapPendingChargeId: charge.id, tapRenewalLockUntil: new Date(now.getTime() + 30 * 60 * 1000) }
      })
      if (charge.status === 'CAPTURED') {
        await applyTapCharge({ ...charge, metadata: { ...charge.metadata, udf1: organization.id, udf2: 'annual-renewal', udf3: attemptId } })
        captured++
      } else if (charge.status === 'INITIATED') {
        initiated++
      } else {
        await applyTapCharge({ ...charge, metadata: { ...charge.metadata, udf1: organization.id, udf2: 'annual-renewal', udf3: attemptId } })
        failed++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Renewal attempt failed.'
      await organizationModel.update({
        where: { id: organization.id },
        data: {
          billingStatus: 'PAST_DUE',
          billingGraceUntil: organization.billingCurrentPeriodEnd
            ? new Date(organization.billingCurrentPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          billingAttemptId: null,
          tapPendingChargeId: null,
          tapRenewalLockUntil: null
        }
      }).catch(() => undefined)
      await paymentModel.create({
        data: {
          organizationId: organization.id,
          provider: 'TAP',
          providerReference: `failed-${attemptId}`,
          kind: 'RENEWAL',
          amountMinor: organization.billingAmountMinor || annualOrganizationPriceSar() * 100,
          currency: organization.billingCurrency || 'SAR',
          status: 'FAILED',
          failureReason: message.slice(0, 250)
        }
      }).catch(() => undefined)
      errors.push({ organizationId: organization.id, message })
      failed++
    }
  }
  return { checked: candidates.length, pending: pendingRenewals.length, reconciled, expired: expired.length, captured, initiated, failed, errors }
}

export async function publicPurchaseStatus(organizationSlug: string) {
  const organization = await (controlDb as any).organization.findUnique({
    where: { slug: organizationSlug.trim().toLowerCase() },
    select: { status: true, billingStatus: true, billingCurrentPeriodEnd: true }
  })
  if (!organization) return null
  return {
    ready: organization.status === 'ACTIVE' && organization.billingStatus === 'ACTIVE',
    organizationStatus: organization.status,
    billingStatus: organization.billingStatus,
    periodEnd: organization.billingCurrentPeriodEnd
  }
}
