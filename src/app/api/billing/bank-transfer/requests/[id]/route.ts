import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { controlDb } from '@/lib/db'
import { provisionOrganization } from '@/lib/organization-provisioning'

export const maxDuration = 60

const actionSchema = z.object({ action: z.enum(['CONFIRM_TRANSFER', 'REJECT']) })

function addPlanPeriod(start: Date, plan: string) {
  const end = new Date(start)
  const day = end.getUTCDate()
  end.setUTCDate(1)
  if (plan === 'YEARLY') end.setUTCFullYear(end.getUTCFullYear() + 1)
  else end.setUTCMonth(end.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(day, lastDay))
  return end
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]!)
}

async function sendWorkspaceReadyEmail(to: string, organizationName: string, slug: string) {
  if (!process.env.RESEND_API_KEY) return false
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://fleetmaintenance.site').replace(/\/$/, '')
  const loginUrl = `${baseUrl}/login?org=${encodeURIComponent(slug)}`
  const safeName = escapeHtml(organizationName)
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
    to,
    subject: `${organizationName} workspace is ready`,
    text: `Your Fleet Manager workspace is ready. Sign in at ${loginUrl} using your administrator email and choose email OTP if you have not set a password.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px;color:#111827"><h1 style="font-size:22px">${safeName} workspace is ready</h1><p>Your bank transfer was confirmed and your separate Fleet Manager workspace has been created.</p><p>Sign in with your administrator email. Choose email OTP if you have not set a password yet.</p><p><a href="${loginUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#4f46e5;color:white;text-decoration:none">Open your workspace</a></p></div>`
  })
  return !result.error
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN' || !user.isPrimaryOrganization) {
      return NextResponse.json({ error: 'Only the primary organization administrator can review bank transfers.' }, { status: 403 })
    }

    const { id } = await params
    const parsed = actionSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Choose a valid transfer review action.' }, { status: 400 })

    if (parsed.data.action === 'REJECT') {
      const updated = await (controlDb as any).organizationPurchaseRequest.updateMany({
        where: { id, status: 'AWAITING_TRANSFER' },
        data: { status: 'REJECTED', reviewedByEmail: user.email, reviewedAt: new Date() }
      })
      if (updated.count !== 1) return NextResponse.json({ error: 'This request has already been reviewed.' }, { status: 409 })
      return NextResponse.json({ success: true, status: 'REJECTED' })
    }

    const approvedOrganization = await controlDb.$transaction(async (transaction) => {
      const purchaseRequests = (transaction as any).organizationPurchaseRequest
      const claimed = await purchaseRequests.updateMany({
        where: { id, status: 'AWAITING_TRANSFER' },
        data: { status: 'PROCESSING', reviewedByEmail: user.email, reviewedAt: new Date() }
      })
      if (claimed.count !== 1) throw new Error('This request has already been reviewed.')

      const purchase = await purchaseRequests.findUnique({ where: { id } })
      if (!purchase) throw new Error('Transfer request not found.')

      const start = new Date()
      const end = addPlanPeriod(start, purchase.plan)
      const organization = await (transaction as any).organization.create({
        data: {
          name: purchase.organizationName,
          slug: purchase.workspaceCode,
          ownerName: purchase.administratorName,
          ownerEmail: purchase.administratorEmail.toLowerCase(),
          ownerPhone: purchase.phone,
          status: 'PROVISIONING',
          isPrimary: false,
          billingProvider: 'BANK_TRANSFER',
          billingStatus: 'ACTIVE',
          billingAmountMinor: purchase.amountMinor,
          billingCurrency: purchase.currency,
          billingCurrentPeriodStart: start,
          billingCurrentPeriodEnd: end,
          billingCancelAtPeriodEnd: false
        }
      })

      await (transaction as any).organizationBillingPayment.create({
        data: {
          organizationId: organization.id,
          provider: 'BANK_TRANSFER',
          providerReference: purchase.paymentReference,
          kind: purchase.plan,
          amountMinor: purchase.amountMinor,
          currency: purchase.currency,
          status: 'PAID',
          periodStart: start,
          periodEnd: end
        }
      })

      await purchaseRequests.update({
        where: { id },
        data: { status: 'APPROVED', organizationId: organization.id, reviewedAt: start, reviewedByEmail: user.email }
      })
      return { id: organization.id, name: organization.name, slug: organization.slug, ownerEmail: organization.ownerEmail }
    })

    let setupError: string | null = null
    try {
      await provisionOrganization(approvedOrganization.id)
    } catch (error) {
      setupError = error instanceof Error ? error.message : 'Neon database setup did not finish.'
    }

    const organization = await (controlDb as any).organization.findUnique({
      where: { id: approvedOrganization.id },
      select: { status: true }
    })
    let emailSent = false
    if (organization?.status === 'ACTIVE') {
      try {
        emailSent = await sendWorkspaceReadyEmail(approvedOrganization.ownerEmail || '', approvedOrganization.name, approvedOrganization.slug)
      } catch (error) {
        console.error('Workspace-ready email could not be sent:', error)
      }
    }

    const loginUrl = new URL(`/login?org=${encodeURIComponent(approvedOrganization.slug)}`, request.nextUrl.origin).toString()
    return NextResponse.json({
      success: true,
      status: 'APPROVED',
      organizationStatus: organization?.status || 'PROVISIONING',
      organization: approvedOrganization,
      loginUrl,
      emailSent,
      setupError
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'No token provided' || message === 'Invalid token') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (message === 'This request has already been reviewed.') {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'That workspace code is already in use. Reject this request and ask the customer to submit a new one with another code.' }, { status: 409 })
    }
    console.error('Bank-transfer approval failed:', error)
    return NextResponse.json({ error: message || 'Could not approve the transfer request.' }, { status: 500 })
  }
}
