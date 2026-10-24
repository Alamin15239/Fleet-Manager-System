import { NextRequest, NextResponse } from 'next/server'
import { addMonths, addYears } from 'date-fns'
import { controlDb } from '@/lib/db'
import { provisionOrganization } from '@/lib/organization-provisioning'
import { capturePayPalOrder, getPayPalOrder, getPayPalOrderCapture, getPayPalPlanPrice, type PayPalBillingPeriod } from '@/lib/paypal'

export const runtime = 'nodejs'
export const maxDuration = 60

function amountMinor(value?: string) {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null
  return Math.round(Number(value) * 100)
}

function addAccessPeriod(start: Date, period: PayPalBillingPeriod) {
  return period === 'MONTHLY' ? addMonths(start, 1) : addYears(start, 1)
}

function responseForPurchase(purchase: any, organization?: any) {
  return {
    success: true,
    status: purchase.status,
    message: purchase.status === 'COMPLETE'
      ? (purchase.isRenewal ? 'Workspace access was renewed.' : 'Workspace is ready.')
      : purchase.failureReason || 'Payment is confirmed. Workspace setup needs to be retried.',
    organization: organization ? { name: organization.name, slug: organization.slug, ownerEmail: organization.ownerEmail } : undefined
  }
}

export async function POST(request: NextRequest) {
  let purchase: any = null
  let paymentCaptured = false
  try {
    const body = await request.json().catch(() => ({}))
    const purchaseId = typeof body.purchaseId === 'string' ? body.purchaseId : ''
    const orderId = typeof body.orderId === 'string' ? body.orderId : ''
    if (!purchaseId || !orderId) return NextResponse.json({ error: 'Purchase and PayPal order IDs are required.' }, { status: 400 })

    const purchaseModel = (controlDb as any).payPalOrganizationPurchase
    purchase = await purchaseModel.findUnique({ where: { id: purchaseId } })
    if (!purchase || !purchase.paypalOrderId || purchase.paypalOrderId !== orderId) {
      return NextResponse.json({ error: 'This PayPal order does not match a valid workspace purchase.' }, { status: 404 })
    }
    if (purchase.status === 'COMPLETE') {
      const organization = purchase.organizationId ? await (controlDb as any).organization.findUnique({ where: { id: purchase.organizationId } }) : null
      return NextResponse.json(responseForPurchase(purchase, organization), { headers: { 'Cache-Control': 'no-store' } })
    }

    const planPeriod = purchase.period as PayPalBillingPeriod
    const order = await getPayPalOrder(orderId)
    const unit = order.purchase_units?.[0]
    const price = getPayPalPlanPrice(planPeriod)
    if (order.intent !== 'CAPTURE' || unit?.custom_id !== purchase.id) {
      return NextResponse.json({ error: 'PayPal order verification failed. No workspace was activated.' }, { status: 400 })
    }
    if (unit.amount?.currency_code !== purchase.currency || unit.amount?.currency_code !== price.currency || amountMinor(unit.amount?.value) !== purchase.amountMinor || purchase.amountMinor !== price.amountMinor) {
      return NextResponse.json({ error: 'The PayPal order amount does not match the selected plan. No workspace was activated.' }, { status: 400 })
    }

    let capture = getPayPalOrderCapture(order)
    if (!capture) {
      if (order.status !== 'APPROVED') {
        return NextResponse.json({ error: 'PayPal has not approved this payment yet. Complete the PayPal checkout, then try again.' }, { status: 409 })
      }
      const captureResult = await capturePayPalOrder(orderId, purchase.id)
      capture = getPayPalOrderCapture(captureResult)
    }
    if (!capture?.id || capture.status !== 'COMPLETED' || amountMinor(capture.amount?.value) !== purchase.amountMinor || capture.amount?.currency_code !== purchase.currency) {
      return NextResponse.json({ error: 'PayPal did not confirm a completed payment. No workspace was activated.' }, { status: 402 })
    }
    paymentCaptured = true

    const now = new Date()
    let organization: any
    let periodStart = now
    let periodEnd: Date

    const organizationModel = (controlDb as any).organization
    if (purchase.isRenewal) {
      organization = await organizationModel.findUnique({ where: { id: purchase.organizationId } })
      if (!organization || organization.isPrimary) throw new Error('The workspace selected for renewal could not be found.')
      const alreadyApplied = organization.billingAttemptId === purchase.id
      if (alreadyApplied && organization.billingCurrentPeriodStart && organization.billingCurrentPeriodEnd) {
        periodStart = new Date(organization.billingCurrentPeriodStart)
        periodEnd = new Date(organization.billingCurrentPeriodEnd)
      } else {
        const previousEnd = organization.billingCurrentPeriodEnd ? new Date(organization.billingCurrentPeriodEnd) : null
        periodStart = previousEnd && previousEnd > now ? previousEnd : now
        periodEnd = addAccessPeriod(periodStart, planPeriod)
        organization = await organizationModel.update({
          where: { id: organization.id },
          data: {
            status: 'ACTIVE',
            billingProvider: 'PAYPAL',
            billingStatus: 'ACTIVE',
            billingAmountMinor: purchase.amountMinor,
            billingCurrency: purchase.currency,
            billingCurrentPeriodStart: periodStart,
            billingCurrentPeriodEnd: periodEnd,
            billingGraceUntil: null,
            billingCancelAtPeriodEnd: false,
            billingAttemptId: purchase.id,
            paypalOrderId: orderId,
            paypalCaptureId: capture.id,
            paypalPlanPeriod: planPeriod
          }
        })
      }
    } else {
      const existing = await organizationModel.findUnique({ where: { slug: purchase.organizationSlug } })
      if (existing && existing.billingAttemptId !== purchase.id) {
        throw new Error('That workspace code was claimed while payment was processing. Contact support with your PayPal order ID so the payment can be matched safely.')
      }
      if (existing) {
        organization = existing
        if (organization.billingCurrentPeriodStart && organization.billingCurrentPeriodEnd) {
          periodStart = new Date(organization.billingCurrentPeriodStart)
          periodEnd = new Date(organization.billingCurrentPeriodEnd)
        } else {
          periodEnd = addAccessPeriod(periodStart, planPeriod)
        }
        if (organization.status === 'FAILED') {
          organization = await organizationModel.update({
            where: { id: organization.id },
            data: { status: 'PROVISIONING', failureReason: null }
          })
        }
      } else {
        periodEnd = addAccessPeriod(periodStart, planPeriod)
        organization = await organizationModel.create({
          data: {
            name: purchase.organizationName,
            slug: purchase.organizationSlug,
            ownerName: purchase.ownerName,
            ownerEmail: purchase.ownerEmail,
            ownerPhone: purchase.ownerPhone,
            status: 'PROVISIONING',
            isPrimary: false,
            billingProvider: 'PAYPAL',
            billingStatus: 'ACTIVE',
            billingAmountMinor: purchase.amountMinor,
            billingCurrency: purchase.currency,
            billingCurrentPeriodStart: periodStart,
            billingCurrentPeriodEnd: periodEnd,
            billingCancelAtPeriodEnd: false,
            billingAttemptId: purchase.id,
            paypalOrderId: orderId,
            paypalCaptureId: capture.id,
            paypalPlanPeriod: planPeriod
          }
        })
      }
      await purchaseModel.update({ where: { id: purchase.id }, data: { organizationId: organization.id, status: 'PAID' } })
    }
    await (controlDb as any).organizationBillingPayment.upsert({
      where: { providerReference: `PAYPAL:${capture.id}` },
      create: {
        organizationId: organization.id,
        provider: 'PAYPAL',
        providerReference: `PAYPAL:${capture.id}`,
        kind: purchase.isRenewal ? 'RENEWAL' : 'NEW_WORKSPACE',
        amountMinor: purchase.amountMinor,
        currency: purchase.currency,
        status: 'SUCCEEDED',
        periodStart,
        periodEnd
      },
      update: { status: 'SUCCEEDED', periodStart, periodEnd }
    })

    if (!purchase.isRenewal && organization.status !== 'ACTIVE') {
      try {
        await provisionOrganization(organization.id)
        organization = await (controlDb as any).organization.findUnique({ where: { id: organization.id } })
      } catch (error) {
        const reason = error instanceof Error ? error.message.slice(0, 300) : 'Automatic workspace setup failed.'
        await purchaseModel.update({ where: { id: purchase.id }, data: { status: 'PAID_SETUP_FAILED', organizationId: organization.id, failureReason: reason } })
        return NextResponse.json({ success: true, status: 'PAID_SETUP_FAILED', message: 'Payment succeeded, but automatic database setup failed. Retry setup or contact the administrator.', organization: { name: organization.name, slug: organization.slug, ownerEmail: organization.ownerEmail } }, { headers: { 'Cache-Control': 'no-store' } })
      }
    }

    const completed = await purchaseModel.update({ where: { id: purchase.id }, data: { status: 'COMPLETE', organizationId: organization.id, paypalCaptureId: capture.id, failureReason: null } })
    return NextResponse.json(responseForPurchase(completed, organization), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('PayPal payment capture/setup failed:', error)
    if (purchase && paymentCaptured) {
      const reason = error instanceof Error ? error.message.slice(0, 300) : 'Payment succeeded but workspace setup failed.'
      await (controlDb as any).payPalOrganizationPurchase.update({
        where: { id: purchase.id },
        data: { status: 'PAID_SETUP_FAILED', failureReason: reason }
      }).catch(() => undefined)
      return NextResponse.json({ success: true, status: 'PAID_SETUP_FAILED', message: 'Payment succeeded, but workspace setup failed. Retry or contact the administrator.' }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const message = error instanceof Error ? error.message.slice(0, 300) : 'Could not verify the PayPal payment.'
    return NextResponse.json({ error: message }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}