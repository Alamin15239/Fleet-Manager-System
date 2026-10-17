import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { createPurchaseInvoiceShareToken } from '@/lib/purchase-invoice-share'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRolePermission(request, 'purchase-invoices', 'read')
    const { id } = await context.params
    const invoice = await db.purchaseInvoice.findUnique({ where: { id }, select: { id: true } })
    if (!invoice) return NextResponse.json({ error: 'Purchase invoice not found' }, { status: 404 })

    const token = createPurchaseInvoiceShareToken(id)
    const shareUrl = new URL(`/share/purchase-invoices/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, request.nextUrl.origin).toString()
    const company = await db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } })
    return NextResponse.json({ shareUrl, company }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create an invoice link'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Unable to create an invoice link' : message }, { status })
  }
}
