import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { createPurchaseInvoiceShareToken } from '@/lib/purchase-invoice-share'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'purchase-invoices', 'read')
    const body = await request.json()
    const rawIds: unknown[] = Array.isArray(body.invoiceIds) ? body.invoiceIds : []
    const normalizedIds = rawIds.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean)
    const invoiceIds = Array.from(new Set<string>(normalizedIds))

    if (!invoiceIds.length) return NextResponse.json({ error: 'Select at least one invoice' }, { status: 400 })
    if (invoiceIds.length > 50) return NextResponse.json({ error: 'A batch can include up to 50 invoices' }, { status: 400 })

    const [invoices, company] = await Promise.all([
      db.purchaseInvoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true } }),
      db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } }),
    ])
    if (invoices.length !== invoiceIds.length) return NextResponse.json({ error: 'One or more selected invoices could not be found' }, { status: 404 })

    const organizationQuery = user.organizationSlug ? `&org=${encodeURIComponent(user.organizationSlug)}` : ''
    const links = invoices.map(({ id }) => ({
      invoiceId: id,
      shareUrl: new URL(`/share/purchase-invoices/${encodeURIComponent(id)}?token=${encodeURIComponent(createPurchaseInvoiceShareToken(id))}${organizationQuery}`, request.nextUrl.origin).toString(),
    }))
    return NextResponse.json({ links, company }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to prepare invoice links'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Unable to prepare invoice links' : message }, { status })
  }
}
