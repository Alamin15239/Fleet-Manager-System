import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export class PurchaseInvoiceReportInputError extends Error {
  constructor(message: string) { super(message); this.name = 'PurchaseInvoiceReportInputError' }
}

export interface PurchaseInvoiceReportInput {
  assetKeys?: unknown
  search?: unknown
  dateFrom?: unknown
  dateTo?: unknown
  amountMin?: unknown
  amountMax?: unknown
  status?: unknown
}

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

function dateFilterValue(value: unknown, edge: 'start' | 'end') {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(`${value}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`)
  if (Number.isNaN(date.getTime())) throw new PurchaseInvoiceReportInputError(`Enter a valid ${edge === 'start' ? 'start' : 'end'} date`)
  return date
}

function amountValue(value: unknown, label: string) {
  if (value === '' || value === null || value === undefined) return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) throw new PurchaseInvoiceReportInputError(`Enter a valid ${label} payable amount`)
  return amount
}

export async function getPurchaseInvoiceReportData(input: PurchaseInvoiceReportInput) {
  const rawAssetKeys: unknown[] = Array.isArray(input.assetKeys) ? input.assetKeys : []
  const assetKeys = Array.from(new Set(rawAssetKeys.filter((key): key is string => typeof key === 'string').map((key) => key.trim()).filter(Boolean)))
  if (!assetKeys.length) throw new PurchaseInvoiceReportInputError('Select at least one truck or trailer')
  if (assetKeys.length > 500) throw new PurchaseInvoiceReportInputError('Select no more than 500 fleet assets in one report')

  const truckIds: string[] = []
  const trailerIds: string[] = []
  for (const key of assetKeys) {
    if (key.startsWith('TRUCK:') && key.slice(6)) truckIds.push(key.slice(6))
    else if (key.startsWith('TRAILER:') && key.slice(8)) trailerIds.push(key.slice(8))
  }
  const selectedLineFilters: Prisma.PurchaseInvoiceLineWhereInput[] = []
  if (truckIds.length) selectedLineFilters.push({ truckId: { in: truckIds } })
  if (trailerIds.length) selectedLineFilters.push({ trailerId: { in: trailerIds } })
  if (!selectedLineFilters.length) throw new PurchaseInvoiceReportInputError('Select valid truck or trailer accounts')

  const dateFilter: Prisma.DateTimeFilter = {}
  const from = dateFilterValue(input.dateFrom, 'start')
  const to = dateFilterValue(input.dateTo, 'end')
  if (from) dateFilter.gte = from
  if (to) dateFilter.lte = to
  if (from && to && from > to) throw new PurchaseInvoiceReportInputError('Start date cannot be after end date')

  const query = typeof input.search === 'string' ? input.search.trim().slice(0, 160) : ''
  const status = input.status === 'VOID' || input.status === 'ALL' ? input.status : 'POSTED'
  const minimum = amountValue(input.amountMin, 'minimum')
  const maximum = amountValue(input.amountMax, 'maximum')
  if (minimum !== null && maximum !== null && minimum > maximum) throw new PurchaseInvoiceReportInputError('Minimum payable cannot exceed maximum payable')

  const invoiceFilters: Prisma.PurchaseInvoiceWhereInput[] = [{ lines: { some: { OR: selectedLineFilters } } }]
  if (Object.keys(dateFilter).length) invoiceFilters.push({ invoiceDate: dateFilter })
  if (status !== 'ALL') invoiceFilters.push({ status })
  if (query) {
    const matchingLineFields: Prisma.PurchaseInvoiceLineWhereInput[] = [{ description: { contains: query, mode: 'insensitive' } }]
    if (truckIds.length) matchingLineFields.push(
      { truck: { is: { licensePlate: { contains: query, mode: 'insensitive' } } } },
      { truck: { is: { make: { contains: query, mode: 'insensitive' } } } },
      { truck: { is: { model: { contains: query, mode: 'insensitive' } } } },
    )
    if (trailerIds.length) matchingLineFields.push({ trailer: { is: { number: { contains: query, mode: 'insensitive' } } } })
    invoiceFilters.push({ OR: [
      { internalNumber: { contains: query, mode: 'insensitive' } },
      { vendorInvoiceNumber: { contains: query, mode: 'insensitive' } },
      { vendor: { is: { name: { contains: query, mode: 'insensitive' } } } },
      { lines: { some: { AND: [{ OR: selectedLineFilters }, { OR: matchingLineFields }] } } },
    ] })
  }

  const [invoices, company, trucks, trailers] = await Promise.all([
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
    truckIds.length ? db.truck.findMany({ where: { id: { in: truckIds } }, select: { id: true, licensePlate: true, make: true, model: true, year: true } }) : Promise.resolve([]),
    trailerIds.length ? db.trailer.findMany({ where: { id: { in: trailerIds } }, select: { id: true, number: true } }) : Promise.resolve([]),
  ])

  const filteredInvoices = invoices.map(serializeInvoice).map((invoice: any) => ({
    invoice,
    lines: invoice.lines,
    payable: invoice.lines.reduce((sum: number, line: any) => sum + line.totalAmount, 0),
  })).filter(({ payable }: { payable: number }) => (minimum === null || payable >= minimum) && (maximum === null || payable <= maximum))

  const assets = [
    ...trucks.map((truck) => ({ key: `TRUCK:${truck.id}`, label: `${truck.licensePlate} · ${truck.make} ${truck.model} (${truck.year})` })),
    ...trailers.map((trailer) => ({ key: `TRAILER:${trailer.id}`, label: `Trailer ${trailer.number}` })),
  ]
  return { company, invoices: filteredInvoices, assets }
}
