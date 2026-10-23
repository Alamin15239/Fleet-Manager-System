import { NextRequest, NextResponse } from 'next/server'
import { db, findOrganizationBySlug, withOrganization } from '@/lib/db'
import { getPurchaseInvoiceReportData, PurchaseInvoiceReportInputError } from '@/lib/purchase-invoice-report-data'
import { verifyPurchaseInvoiceReportShareToken } from '@/lib/purchase-invoice-report-share'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const payload = verifyPurchaseInvoiceReportShareToken(token)
  if (!payload || !payload.assetKeys.length) {
    return NextResponse.json({ error: 'This report link is invalid' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const organization = await findOrganizationBySlug(payload.organizationSlug)
    return await withOrganization(organization, async () => {
      const report = await getPurchaseInvoiceReportData(payload)
      return NextResponse.json({ ...report, filters: payload }, { headers: { 'Cache-Control': 'no-store' } })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = error instanceof PurchaseInvoiceReportInputError ? 400 : message === 'Organization was not found or is not ready' ? 404 : 500
    return NextResponse.json({ error: status === 400 || status === 404 ? message : 'Unable to load this purchase invoice report' }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
