import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'purchase-invoices', 'read')
    const search = request.nextUrl.searchParams
    const type = search.get('type')
    const id = search.get('id')
    if (!id || !['TRUCK', 'TRAILER', 'VENDOR', 'VAT'].includes(type || '')) {
      return NextResponse.json({ error: 'Choose a valid account' }, { status: 400 })
    }

    const account = type === 'VAT'
      ? await db.fleetLedgerAccount.findUnique({ where: { code: 'TAX-INPUT-VAT' } })
      : type === 'TRUCK'
        ? await db.fleetLedgerAccount.findUnique({ where: { truckId: id } })
        : type === 'TRAILER'
          ? await db.fleetLedgerAccount.findUnique({ where: { trailerId: id } })
          : await db.fleetLedgerAccount.findUnique({ where: { vendorId: id } })

    if (!account) return NextResponse.json({ success: true, account: null, lines: [], balance: 0 })
    const [lines, totals] = await Promise.all([
      db.purchaseJournalLine.findMany({
        where: { accountId: account.id },
        include: { entry: { include: { invoice: { include: { vendor: true } } } }, invoiceLine: true },
        orderBy: [{ entry: { entryDate: 'desc' } }, { id: 'desc' }],
        take: 1000,
      }),
      db.purchaseJournalLine.aggregate({ where: { accountId: account.id }, _sum: { debit: true, credit: true } }),
    ])

    const debit = Number(totals._sum.debit || 0)
    const credit = Number(totals._sum.credit || 0)
    const naturalBalance = account.type === 'VENDOR_PAYABLE' ? credit - debit : debit - credit
    return NextResponse.json({
      success: true,
      account: { id: account.id, code: account.code, name: account.name, type: account.type },
      balance: Math.max(0, naturalBalance),
      lines: lines.map((line) => ({
        id: line.id,
        date: line.entry.entryDate,
        invoiceId: line.entry.invoice.id,
        invoiceNumber: line.entry.invoice.internalNumber,
        vendor: line.entry.invoice.vendor.name,
        vendorInvoiceNumber: line.entry.invoice.vendorInvoiceNumber,
        category: line.category,
        description: line.description,
        debit: Number(line.debit),
        credit: Number(line.credit),
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : 'Failed to load account activity' }, { status })
  }
}
