import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { controlDb, encryptOrganizationDatabaseUrl } from '@/lib/db'
import { createPayPalOrder, getPayPalAccessToken, getPayPalPlanPrice, type PayPalBillingPeriod } from '@/lib/paypal'

export const runtime = 'nodejs'
export const maxDuration = 30

const inputSchema = z.object({
  mode: z.enum(['new', 'renew']),
  period: z.enum(['MONTHLY', 'YEARLY']),
  organizationName: z.string().trim().min(2).max(80).optional(),
  organizationSlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(48),
  ownerName: z.string().trim().min(1).max(100).optional(),
  ownerEmail: z.string().trim().email().max(254),
  ownerPhone: z.string().trim().max(40).optional()
})

function safeFailure(error: unknown) {
  return error instanceof Error ? error.message.replace(/https?:\/\/[^\s]+/gi, '[provider URL]').slice(0, 300) : 'Could not start PayPal checkout.'
}

export async function POST(request: NextRequest) {
  let purchaseId: string | undefined
  try {
    const parsed = inputSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Enter valid workspace, administrator, email, and plan details.' }, { status: 400 })
    const form = parsed.data
    const period = form.period as PayPalBillingPeriod
    const organizationModel = (controlDb as any).organization
    let organizationId: string | null = null
    let organizationName = form.organizationName?.trim() || ''
    let ownerName = form.ownerName?.trim() || ''
    let ownerEmail = form.ownerEmail.trim().toLowerCase()
    let ownerPhone = form.ownerPhone?.trim() || null

    const existing = await organizationModel.findUnique({ where: { slug: form.organizationSlug } })
    if (form.mode === 'renew') {
      if (!existing || existing.isPrimary || !existing.ownerEmail || existing.ownerEmail.toLowerCase() !== ownerEmail) {
        return NextResponse.json({ error: 'Workspace code and administrator email did not match an existing workspace.' }, { status: 404 })
      }
      organizationId = existing.id
      organizationName = existing.name
      ownerName = existing.ownerName || ownerEmail
      ownerEmail = existing.ownerEmail.toLowerCase()
      ownerPhone = existing.ownerPhone || null
    } else {
      if (existing) return NextResponse.json({ error: 'That workspace code is already in use. Choose a different code or renew the existing workspace.' }, { status: 409 })
      if (!organizationName || !ownerName) return NextResponse.json({ error: 'Company name and administrator name are required for a new workspace.' }, { status: 400 })
      if (!process.env.NEON_API_KEY?.trim()) return NextResponse.json({ error: 'Workspace database provisioning is not configured. Ask the administrator to add NEON_API_KEY in Vercel before checkout.' }, { status: 503 })
      try {
        encryptOrganizationDatabaseUrl('configuration-check')
      } catch (configurationError) {
        const message = configurationError instanceof Error ? configurationError.message : 'Organization database encryption is not configured.'
        return NextResponse.json({ error: message }, { status: 503 })
      }
    }

    const price = getPayPalPlanPrice(period)
    await getPayPalAccessToken()
    const purchaseModel = (controlDb as any).payPalOrganizationPurchase
    const purchase = await purchaseModel.create({
      data: {
        organizationId,
        isRenewal: Boolean(organizationId),
        organizationName,
        organizationSlug: form.organizationSlug,
        ownerName,
        ownerEmail,
        ownerPhone,
        period,
        amountMinor: price.amountMinor,
        currency: price.currency,
        status: 'PENDING'
      }
    })
    purchaseId = purchase.id

    const order = await createPayPalOrder({
      purchaseId: purchase.id,
      period,
      amountMinor: price.amountMinor,
      currency: price.currency
    })
    if (!order.id) throw new Error('PayPal did not return an order ID. Check the sandbox app configuration and try again.')

    await purchaseModel.update({ where: { id: purchase.id }, data: { paypalOrderId: order.id } })
    return NextResponse.json({
      success: true,
      purchaseId: purchase.id,
      orderId: order.id,
      amountMinor: price.amountMinor,
      currency: price.currency,
      period
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (purchaseId) {
      await (controlDb as any).payPalOrganizationPurchase.update({
        where: { id: purchaseId },
        data: { status: 'FAILED', failureReason: safeFailure(error) }
      }).catch(() => undefined)
    }
    console.error('PayPal checkout creation failed:', error)
    return NextResponse.json({ error: safeFailure(error) }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
export async function GET() {
  try {
    const monthly = getPayPalPlanPrice('MONTHLY')
    const yearly = getPayPalPlanPrice('YEARLY')
    return NextResponse.json({
      currency: 'USD',
      monthly,
      yearly,
      clientId: process.env.PAYPAL_CLIENT_ID?.trim() || null
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load plan pricing.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
