import { NextRequest, NextResponse } from 'next/server'
import { requireRolePermission } from '@/lib/permission-middleware'
import { getPurchaseInvoiceReportData, PurchaseInvoiceReportInputError } from '@/lib/purchase-invoice-report-data'
import { createPurchaseInvoiceReportShareToken } from '@/lib/purchase-invoice-report-share'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'purchase-invoices', 'read')
    const body = await request.json()
    const data = await getPurchaseInvoiceReportData(body)
    const token = createPurchaseInvoiceReportShareToken({
      organizationSlug: user.organizationSlug || null,
      assetKeys: data.assets.map((asset) => asset.key),
      search: typeof body.search === 'string' ? body.search.trim().slice(0, 160) : '',
      dateFrom: typeof body.dateFrom === 'string' ? body.dateFrom.slice(0, 10) : '',
      dateTo: typeof body.dateTo === 'string' ? body.dateTo.slice(0, 10) : '',
      amountMin: body.amountMin === null || body.amountMin === undefined ? '' : String(body.amountMin),
      amountMax: body.amountMax === null || body.amountMax === undefined ? '' : String(body.amountMax),
      status: body.status === 'VOID' || body.status === 'ALL' ? body.status : 'POSTED',
    })
    const shareUrl = new URL(`/share/purchase-invoice-reports/${encodeURIComponent(token)}`, request.nextUrl.origin).toString()
    return NextResponse.json({ success: true, ...data, shareUrl }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = error instanceof PurchaseInvoiceReportInputError ? 400 : ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ success: false, error: status === 400 ? message : status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : 'Could not generate purchase invoice report' }, { status })
  }
}
