import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { controlDb } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limiter'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  organizationName: z.string().trim().min(2).max(80),
  workspaceCode: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(48),
  administratorName: z.string().trim().min(1).max(100),
  administratorEmail: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  plan: z.enum(['MONTHLY', 'YEARLY']),
  agreementAccepted: z.literal(true)
})

function getPublicConfig(settings: any) {
  const monthlyPriceMinor = Number.isInteger(settings?.bankTransferMonthlyPriceMinor)
    ? settings.bankTransferMonthlyPriceMinor as number
    : null
  const yearlyPriceMinor = Number.isInteger(settings?.bankTransferYearlyPriceMinor)
    ? settings.bankTransferYearlyPriceMinor as number
    : null
  const bankConfigured = Boolean(settings?.bankAccountName?.trim() && settings?.bankIBAN?.trim())

  return {
    available: bankConfigured && ((monthlyPriceMinor ?? 0) > 0 || (yearlyPriceMinor ?? 0) > 0),
    companyName: settings?.companyName?.trim() || 'Fleet Manager',
    bank: {
      name: settings?.bankName || '',
      accountName: settings?.bankAccountName || '',
      accountNumber: settings?.bankAccountNumber || '',
      iban: settings?.bankIBAN || ''
    },
    plans: {
      MONTHLY: monthlyPriceMinor && monthlyPriceMinor > 0 ? monthlyPriceMinor : null,
      YEARLY: yearlyPriceMinor && yearlyPriceMinor > 0 ? yearlyPriceMinor : null
    },
    currency: 'SAR'
  }
}

export async function GET() {
  try {
    const settings = await controlDb.settings.findFirst({
      select: {
        companyName: true,
        bankName: true,
        bankAccountName: true,
        bankAccountNumber: true,
        bankIBAN: true,
        bankTransferMonthlyPriceMinor: true,
        bankTransferYearlyPriceMinor: true
      }
    })
    return NextResponse.json(getPublicConfig(settings), {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })
  } catch (error) {
    console.error('Could not load bank-transfer checkout settings:', error)
    return NextResponse.json({ error: 'Bank-transfer checkout is temporarily unavailable.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(request, { windowMs: 60 * 60 * 1000, maxRequests: 8 })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many purchase requests. Please try again later.' }, { status: 429 })
  }

  try {
    const parsed = requestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Check the organization details and accept the user agreement.' }, { status: 400 })
    }

    const settings = await controlDb.settings.findFirst({
      select: {
        companyName: true,
        bankName: true,
        bankAccountName: true,
        bankAccountNumber: true,
        bankIBAN: true,
        bankTransferMonthlyPriceMinor: true,
        bankTransferYearlyPriceMinor: true
      }
    })
    const config = getPublicConfig(settings)
    const amountMinor = config.plans[parsed.data.plan]
    if (!config.available || !amountMinor) {
      return NextResponse.json({ error: 'Bank-transfer details and a price for this plan have not been configured yet.' }, { status: 503 })
    }

    const existingOrganization = await (controlDb as any).organization.findUnique({
      where: { slug: parsed.data.workspaceCode },
      select: { id: true }
    })
    if (existingOrganization) {
      return NextResponse.json({ error: 'That workspace code is already in use. Choose another code.' }, { status: 409 })
    }

    const pendingRequest = await (controlDb as any).organizationPurchaseRequest.findFirst({
      where: { workspaceCode: parsed.data.workspaceCode, status: 'AWAITING_TRANSFER' },
      select: { id: true }
    })
    if (pendingRequest) {
      return NextResponse.json({ error: 'That workspace code already has a transfer request awaiting review.' }, { status: 409 })
    }

    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const paymentReference = `FM-${datePart}-${randomBytes(4).toString('hex').toUpperCase()}`
    const purchaseRequest = await (controlDb as any).organizationPurchaseRequest.create({
      data: {
        organizationName: parsed.data.organizationName,
        workspaceCode: parsed.data.workspaceCode,
        administratorName: parsed.data.administratorName,
        administratorEmail: parsed.data.administratorEmail.toLowerCase(),
        phone: parsed.data.phone || null,
        plan: parsed.data.plan,
        amountMinor,
        currency: 'SAR',
        paymentReference,
        status: 'AWAITING_TRANSFER',
        agreementAcceptedAt: new Date(),
        agreementVersion: 'current'
      }
    })

    return NextResponse.json({
      success: true,
      requestId: purchaseRequest.id,
      paymentReference,
      amountMinor,
      currency: 'SAR',
      plan: parsed.data.plan,
      bank: config.bank,
      companyName: config.companyName
    }, { status: 201, headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'That workspace code or transfer request already exists. Refresh and try a different code.' }, { status: 409 })
    }
    console.error('Could not create bank-transfer request:', error)
    return NextResponse.json({ error: 'Could not create the transfer request. Please try again.' }, { status: 500 })
  }
}
