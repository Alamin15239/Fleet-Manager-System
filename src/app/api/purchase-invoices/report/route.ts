import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export const dynamic = 'force-dynamic'

function serializeInvoice(invoice: any) {
  return {
    ...invoice,
    vatRate: Number(invoice.vatRate || 0),
    subtotal: Number(invoice.subtotal || 0),
    vatTotal: Number(invoice.vatTotal || 0),
    grandTotal: Number(invoice.grandTotal || 0),
    lines: invoice.lines.map((line: any) => ({
      ...line,
      quantity: Number(line.quantity || 0),
      unitPrice: Number(line.unitPrice || 0),
      netAmount: Number(line.netAmount || 0),
      vatAmount: Number(line.vatAmount || 0),
      totalAmount: Number(line.totalAmount || 0),
    })),
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'purchase-invoices', 'read')
    const body = await request.json()
    const rawAssetKeys: unknown[] = Array.isArray(body.assetKeys) ? body.assetKeys : []
    const normalizedAssetKeys = rawAssetKeys.filter((key): key is string => typeof key === 'string').map((key) => key.trim()).filter(Boolean)
    const assetKeys: string[] = Array.from(new Set(normalizedAssetKeys))
    if (!assetKeys.length) return NextResponse.json({ error: 'Select at least one truck or trailer' }, { status: 400 })
    if (assetKeys.length > 500) return NextResponse.json({ error: 'Select no more than 500 fleet assets in one report' }, { status: 400 })

    const truckIds: string[] = []
    const trailerIds: string[] = []
    for (const key of assetKeys) {
      if (key.startsWith('TRUCK:') && key.slice(6)) truckIds.push(key.slice(6))
      else if (key.startsWith('TRAILER:') && key.slice(8)) trailerIds.push(key.slice(8))
    }
    const selectedLineFilters: Prisma.PurchaseInvoiceLineWhereInput[] = []
    if (truckIds.length) selectedLineFilters.push({ truckId: { in: truckIds } })
    if (trailerIds.length) selectedLineFilters.push({ trailerId: { in: trailerIds } })
    if (!selectedLineFilters.length) return NextResponse.json({ error: 'Select valid truck or trailer accounts' }, { status: 400 })

    const dateFilter: Prisma.DateTimeFilter = {}
    if (typeof body.dateFrom === 'string' && body.dateFrom) {
      const from = new Date(`${body.dateFrom}T00:00:00.000Z`)
      if (Number.isNaN(from.getTime())) return NextResponse.json({ error: 'Enter a valid start date' }, { status: 400 })
      dateFilter.gte = from
    }
    if (typeof body.dateTo === 'string' && body.dateTo) {
      const to = new Date(`${body.dateTo}T23:59:59.999Z`)
      if (Number.isNaN(to.getTime())) return NextResponse.json({ error: 'Enter a valid end date' }, { status: 400 })
      dateFilter.lte = to
    }

    const query = typeof body.search === 'string' ? body.search.trim().slice(0, 160) : ''
    const status = body.status === 'VOID' || body.status === 'ALL' ? body.status : 'POSTED'
    const minimum = body.amountMin === '' || body.amountMin === null || body.amountMin === undefined ? null : Number(body.amountMin)
    const maximum = body.amountMax === '' || body.amountMax === null || body.amountMax === undefined ? null : Number(body.amountMax)
    if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) return NextResponse.json({ error: 'Enter a valid minimum payable amount' }, { status: 400 })
    if (maximum !== null && (!Number.isFinite(maximum) || maximum < 0)) return NextResponse.json({ error: 'Enter a valid maximum payable amount' }, { status: 400 })
    if (minimum !== null && maximum !== null && minimum > maximum) return NextResponse.json({ error: 'Minimum payable cannot exceed maximum payable' }, { status: 400 })

    const invoiceFilters: Prisma.PurchaseInvoiceWhereInput[] = [
      { lines: { some: { OR: selectedLineFilters } } },
    ]
    if (Object.keys(dateFilter).length) invoiceFilters.push({ invoiceDate: dateFilter })
    if (status !== 'ALL') invoiceFilters.push({ status })
    if (query) {
      const matchingLineFields: Prisma.PurchaseInvoiceLineWhereInput[] = [
        { description: { contains: query, mode: 'insensitive' } },
      ]
      if (truckIds.length) {
        matchingLineFields.push(
          { truck: { is: { licensePlate: { contains: query, mode: 'insensitive' } } } },
          { truck: { is: { make: { contains: query, mode: 'insensitive' } } } },
          { truck: { is: { model: { contains: query, mode: 'insensitive' } } } },
        )
      }
      if (trailerIds.length) matchingLineFields.push({ trailer: { is: { number: { contains: query, mode: 'insensitive' } } } })
      invoiceFilters.push({ OR: [
        { internalNumber: { contains: query, mode: 'insensitive' } },
        { vendorInvoiceNumber: { contains: query, mode: 'insensitive' } },
        { vendor: { is: { name: { contains: query, mode: 'insensitive' } } } },
        { lines: { some: { AND: [{ OR: selectedLineFilters }, { OR: matchingLineFields }] } } },
      ] })
    }

    const [invoices, company] = await Promise.all([
      db.purchaseInvoice.findMany({
        where: { AND: invoiceFilters },
        include: {
          vendor: true,
          lines: {
            where: { OR: selectedLineFilters },
            include: { truck: true, trailer: true },
            orderBy: { lineNumber: 'asc' },
          },
        },
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      }),
      db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } }),
    ])

    const filteredInvoices = invoices.map(serializeInvoice).map((invoice: any) => ({
      invoice,
      lines: invoice.lines,
      payable: invoice.lines.reduce((sum: number, line: any) => sum + line.totalAmount, 0),
    })).filter(({ payable }: { payable: number }) => (minimum === null || payable >= minimum) && (maximum === null || payable <= maximum))

    return NextResponse.json({ success: true, company, invoices: filteredInvoices }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ success: false, error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : 'Could not generate purchase invoice report' }, { status })
  }
}
