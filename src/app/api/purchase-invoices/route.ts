import { NextRequest, NextResponse } from 'next/server'
import { Prisma, PurchaseExpenseCategory } from '@prisma/client'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { trackAPIActivity } from '@/lib/activity-middleware'

const categories = new Set(Object.values(PurchaseExpenseCategory))

function asNumber(value: unknown) {
  if (value === null || value === undefined) return 0
  return Number(value)
}

function decimalFromCents(cents: number) {
  return new Prisma.Decimal((cents / 100).toFixed(2))
}

function serializeInvoice(invoice: any) {
  return {
    ...invoice,
    vatRate: asNumber(invoice.vatRate),
    subtotal: asNumber(invoice.subtotal),
    vatTotal: asNumber(invoice.vatTotal),
    grandTotal: asNumber(invoice.grandTotal),
    lines: invoice.lines.map((line: any) => ({
      ...line,
      quantity: asNumber(line.quantity),
      unitPrice: asNumber(line.unitPrice),
      netAmount: asNumber(line.netAmount),
      vatAmount: asNumber(line.vatAmount),
      totalAmount: asNumber(line.totalAmount),
    })),
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'purchase-invoices', 'read')

    const [invoices, vendors, trucks, trailers, accounts, balances, totals, company] = await Promise.all([
      db.purchaseInvoice.findMany({
        include: {
          vendor: true,
          lines: { include: { truck: true, trailer: true }, orderBy: { lineNumber: 'asc' } },
        },
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
        take: 500,
      }),
      db.vendor.findMany({ orderBy: { name: 'asc' } }),
      db.truck.findMany({ where: { isDeleted: false }, orderBy: { licensePlate: 'asc' }, select: { id: true, licensePlate: true, make: true, model: true, year: true } }),
      db.trailer.findMany({ where: { isDeleted: false }, orderBy: { number: 'asc' }, select: { id: true, number: true } }),
      db.fleetLedgerAccount.findMany({ where: { isActive: true }, include: { truck: true, trailer: true, vendor: true } }),
      db.purchaseJournalLine.groupBy({ by: ['accountId'], _sum: { debit: true, credit: true } }),
      db.purchaseInvoice.aggregate({
        where: { status: 'POSTED' },
        _count: { _all: true },
        _sum: { subtotal: true, vatTotal: true, grandTotal: true },
      }),
      db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } }),
    ])

    const balanceByAccount = new Map(balances.map((row) => [row.accountId, {
      debit: asNumber(row._sum.debit),
      credit: asNumber(row._sum.credit),
    }]))
    const accountByTruck = new Map(accounts.filter((account) => account.truckId).map((account) => [account.truckId!, account]))
    const accountByTrailer = new Map(accounts.filter((account) => account.trailerId).map((account) => [account.trailerId!, account]))
    const accountByVendor = new Map(accounts.filter((account) => account.vendorId).map((account) => [account.vendorId!, account]))
    const accountBalance = (accountId?: string | null, natural: 'debit' | 'credit' = 'debit') => {
      if (!accountId) return 0
      const balance = balanceByAccount.get(accountId)
      return balance ? Math.max(0, natural === 'debit' ? balance.debit - balance.credit : balance.credit - balance.debit) : 0
    }

    const vehicleAccounts = [
      ...trucks.map((truck) => {
        const account = accountByTruck.get(truck.id)
        return { id: account?.id || null, assetType: 'TRUCK', assetId: truck.id, label: `${truck.licensePlate} · ${truck.make} ${truck.model}`.trim(), code: account?.code || `TRK-${truck.id}`, balance: accountBalance(account?.id) }
      }),
      ...trailers.map((trailer) => {
        const account = accountByTrailer.get(trailer.id)
        return { id: account?.id || null, assetType: 'TRAILER', assetId: trailer.id, label: `Trailer ${trailer.number}`, code: account?.code || `TRL-${trailer.id}`, balance: accountBalance(account?.id) }
      }),
    ]
    const vendorAccounts = vendors.map((vendor) => {
      const account = accountByVendor.get(vendor.id)
      return { id: account?.id || null, vendorId: vendor.id, label: vendor.name, code: account?.code || `AP-${vendor.id}`, active: vendor.isActive, balance: accountBalance(account?.id, 'credit') }
    })
    const inputVatAccount = accounts.find((account) => account.type === 'INPUT_VAT')

    return NextResponse.json({
      success: true,
      company,
      invoices: invoices.map(serializeInvoice),
      vendors,
      trucks,
      trailers,
      vehicleAccounts,
      vendorAccounts,
      inputVatBalance: accountBalance(inputVatAccount?.id),
      summary: {
        invoiceCount: totals._count._all,
        subtotal: asNumber(totals._sum.subtotal),
        vatTotal: asNumber(totals._sum.vatTotal),
        payableTotal: asNumber(totals._sum.grandTotal),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ success: false, error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : 'Failed to load purchase invoices' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'purchase-invoices', 'create')
    const body = await request.json()

    const vendorId = typeof body.vendorId === 'string' ? body.vendorId.trim() : ''
    const invoiceDateText = typeof body.invoiceDate === 'string' ? body.invoiceDate : ''
    const invoiceDate = invoiceDateText ? new Date(`${invoiceDateText}T12:00:00.000Z`) : new Date('invalid')
    const dueDate = typeof body.dueDate === 'string' && body.dueDate ? new Date(`${body.dueDate}T12:00:00.000Z`) : null
    const isVatInvoice = body.isVatInvoice === true
    const pricesIncludeVat = body.pricesIncludeVat === true
    const vatRate = isVatInvoice ? Number(body.vatRate ?? 15) : 0
    const rawLines = Array.isArray(body.lines) ? body.lines : []

    if (!vendorId) return NextResponse.json({ error: 'Select a vendor' }, { status: 400 })
    if (Number.isNaN(invoiceDate.getTime())) return NextResponse.json({ error: 'Enter a valid invoice date' }, { status: 400 })
    if (dueDate && Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: 'Enter a valid due date' }, { status: 400 })
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return NextResponse.json({ error: 'VAT rate must be between 0 and 100' }, { status: 400 })
    if (!rawLines.length) return NextResponse.json({ error: 'Add at least one invoice line' }, { status: 400 })

    const calculatedLines = rawLines.map((line: any, index: number) => {
      const category = String(line.category || '') as PurchaseExpenseCategory
      const description = typeof line.description === 'string' ? line.description.trim() : ''
      const rawQuantity = Number(line.quantity)
      const rawUnitPrice = Number(line.unitPrice)
      const quantity = Math.round(rawQuantity * 1000) / 1000
      const unitPrice = Math.round(rawUnitPrice * 10000) / 10000
      const assetType = line.assetType === 'TRAILER' ? 'TRAILER' : line.assetType === 'TRUCK' ? 'TRUCK' : ''
      const assetId = typeof line.assetId === 'string' ? line.assetId.trim() : ''
      if (!categories.has(category)) throw new Error(`Line ${index + 1}: select a valid expense category`)
      if (!description) throw new Error(`Line ${index + 1}: enter a description`)
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000) throw new Error(`Line ${index + 1}: quantity must be greater than zero`)
      if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1000000000) throw new Error(`Line ${index + 1}: enter a valid unit price`)
      if (!assetType || !assetId) throw new Error(`Line ${index + 1}: assign this expense to a truck or trailer`)

      const enteredCents = Math.round((quantity * unitPrice + Number.EPSILON) * 100)
      const netCents = !isVatInvoice ? enteredCents : pricesIncludeVat ? Math.round(enteredCents / (1 + vatRate / 100)) : enteredCents
      const vatCents = !isVatInvoice ? 0 : pricesIncludeVat ? enteredCents - netCents : Math.round(netCents * vatRate / 100)
      const totalCents = netCents + vatCents
      return { category, description, quantity, unitPrice, assetType, assetId, lineNumber: index + 1, netCents, vatCents, totalCents }
    })

    const subtotalCents = calculatedLines.reduce((sum: number, line: any) => sum + line.netCents, 0)
    const vatTotalCents = calculatedLines.reduce((sum: number, line: any) => sum + line.vatCents, 0)
    const grandTotalCents = calculatedLines.reduce((sum: number, line: any) => sum + line.totalCents, 0)
    if (grandTotalCents <= 0) return NextResponse.json({ error: 'Invoice total must be greater than zero' }, { status: 400 })

    const result = await db.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({ where: { id: vendorId } })
      if (!vendor || !vendor.isActive) throw new Error('Select an active vendor')

      for (const line of calculatedLines) {
        const asset = line.assetType === 'TRUCK'
          ? await tx.truck.findFirst({ where: { id: line.assetId, isDeleted: false }, select: { id: true } })
          : await tx.trailer.findFirst({ where: { id: line.assetId, isDeleted: false }, select: { id: true } })
        if (!asset) throw new Error(`A selected ${line.assetType.toLowerCase()} no longer exists or is inactive`)
      }

      const invoice = await tx.purchaseInvoice.create({
        data: {
          internalNumber: `PI-${randomUUID().slice(0, 12).toUpperCase()}`,
          vendorInvoiceNumber: typeof body.vendorInvoiceNumber === 'string' && body.vendorInvoiceNumber.trim() ? body.vendorInvoiceNumber.trim() : null,
          vendorId,
          invoiceDate,
          dueDate,
          isVatInvoice,
          pricesIncludeVat,
          vatRate: new Prisma.Decimal(vatRate.toFixed(2)),
          subtotal: decimalFromCents(subtotalCents),
          vatTotal: decimalFromCents(vatTotalCents),
          grandTotal: decimalFromCents(grandTotalCents),
          notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
          createdById: user.id,
          status: 'POSTED',
          lines: {
            create: calculatedLines.map((line: any) => ({
              lineNumber: line.lineNumber,
              category: line.category,
              description: line.description,
              quantity: new Prisma.Decimal(line.quantity.toFixed(3)),
              unitPrice: new Prisma.Decimal(line.unitPrice.toFixed(4)),
              netAmount: decimalFromCents(line.netCents),
              vatAmount: decimalFromCents(line.vatCents),
              totalAmount: decimalFromCents(line.totalCents),
              ...(line.assetType === 'TRUCK' ? { truckId: line.assetId } : { trailerId: line.assetId }),
            })),
          },
        },
        include: { lines: true },
      })

      const vendorAccount = await tx.fleetLedgerAccount.upsert({
        where: { vendorId },
        create: { code: `AP-${vendor.id}`, name: `Accounts payable · ${vendor.name}`, type: 'VENDOR_PAYABLE', vendorId },
        update: { name: `Accounts payable · ${vendor.name}`, isActive: true },
      })
      const journalLines: Prisma.PurchaseJournalLineCreateWithoutEntryInput[] = []

      for (let index = 0; index < invoice.lines.length; index++) {
        const savedLine = invoice.lines[index]
        const sourceLine = calculatedLines[index]
        let label: string
        if (sourceLine.assetType === 'TRUCK') {
          const truck = await tx.truck.findUnique({ where: { id: sourceLine.assetId }, select: { licensePlate: true, make: true, model: true } })
          label = `${truck?.licensePlate || 'Truck'} · ${truck?.make || ''} ${truck?.model || ''}`.trim()
        } else {
          const trailer = await tx.trailer.findUnique({ where: { id: sourceLine.assetId }, select: { number: true } })
          label = `Trailer ${trailer?.number || ''}`.trim()
        }
        const accountCode = `${sourceLine.assetType === 'TRUCK' ? 'TRK' : 'TRL'}-${sourceLine.assetId}`
        const account = sourceLine.assetType === 'TRUCK'
          ? await tx.fleetLedgerAccount.upsert({
              where: { truckId: sourceLine.assetId },
              create: { code: accountCode, name: `Fleet expenses · ${label}`, type: 'VEHICLE_EXPENSE', truckId: sourceLine.assetId },
              update: { name: `Fleet expenses · ${label}`, isActive: true },
            })
          : await tx.fleetLedgerAccount.upsert({
              where: { trailerId: sourceLine.assetId },
              create: { code: accountCode, name: `Fleet expenses · ${label}`, type: 'VEHICLE_EXPENSE', trailerId: sourceLine.assetId },
              update: { name: `Fleet expenses · ${label}`, isActive: true },
            })
        journalLines.push({
          account: { connect: { id: account.id } },
          invoiceLine: { connect: { id: savedLine.id } },
          category: savedLine.category,
          description: savedLine.description,
          debit: decimalFromCents(sourceLine.netCents),
          credit: decimalFromCents(0),
        })
      }

      if (vatTotalCents > 0) {
        const vatAccount = await tx.fleetLedgerAccount.upsert({
          where: { code: 'TAX-INPUT-VAT' },
          create: { code: 'TAX-INPUT-VAT', name: 'Input VAT · Tax Authority', type: 'INPUT_VAT' },
          update: { name: 'Input VAT · Tax Authority', isActive: true },
        })
        journalLines.push({
          account: { connect: { id: vatAccount.id } },
          description: `Input VAT · ${invoice.internalNumber}`,
          debit: decimalFromCents(vatTotalCents),
          credit: decimalFromCents(0),
        })
      }

      journalLines.push({
        account: { connect: { id: vendorAccount.id } },
        description: `Vendor payable · ${invoice.internalNumber}`,
        debit: decimalFromCents(0),
        credit: decimalFromCents(grandTotalCents),
      })

      await tx.purchaseJournalEntry.create({
        data: {
          invoiceId: invoice.id,
          entryDate: invoiceDate,
          description: `Purchase invoice ${invoice.internalNumber}`,
          lines: { create: journalLines },
        },
      })

      return tx.purchaseInvoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: { vendor: true, lines: { include: { truck: true, trailer: true }, orderBy: { lineNumber: 'asc' } } },
      })
    })

    await trackAPIActivity(request, 'PURCHASE_INVOICE_POST', 'PURCHASE_INVOICE', result.id, result.internalNumber, undefined, {
      vendorId: result.vendorId,
      total: Number(result.grandTotal),
      vat: Number(result.vatTotal),
      lineCount: result.lines.length,
    })
    return NextResponse.json({ success: true, invoice: serializeInvoice(result) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401
      : message === 'Insufficient permissions' ? 403
      : message.startsWith('Line ') || message.startsWith('Select ') || message.startsWith('A selected ') ? 400
      : 500
    if ((error as any)?.code === 'P2002') {
      return NextResponse.json({ error: 'That vendor invoice number is already entered for this vendor' }, { status: 409 })
    }
    console.error('Purchase invoice creation failed:', error)
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : status === 400 ? message : 'Failed to post purchase invoice. No partial ledger entry was saved.' }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'purchase-invoices', 'update')
    const body = await request.json()
    if (body.action !== 'void' || typeof body.invoiceId !== 'string') {
      return NextResponse.json({ error: 'Choose a posted invoice to reverse' }, { status: 400 })
    }

    const invoiceId = body.invoiceId
    const result = await db.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findUnique({ where: { id: invoiceId } })
      if (!invoice) throw new Error('Purchase invoice not found')
      if (invoice.status !== 'POSTED') throw new Error('Only a posted invoice can be reversed')
      const original = await tx.purchaseJournalEntry.findUnique({ where: { invoiceId_isReversal: { invoiceId, isReversal: false } }, include: { lines: true } })
      if (!original || !original.lines.length) throw new Error('The invoice ledger entry is missing; it cannot be safely reversed')

      await tx.purchaseJournalEntry.create({
        data: {
          invoiceId,
          entryDate: new Date(),
          description: `Reversal of ${invoice.internalNumber}`,
          isReversal: true,
          lines: {
            create: original.lines.map((line) => ({
              accountId: line.accountId,
              invoiceLineId: line.invoiceLineId,
              category: line.category,
              description: `Reversal · ${line.description}`,
              debit: line.credit,
              credit: line.debit,
            })),
          },
        },
      })
      return tx.purchaseInvoice.update({ where: { id: invoiceId }, data: { status: 'VOID' } })
    })

    await trackAPIActivity(request, 'PURCHASE_INVOICE_VOID', 'PURCHASE_INVOICE', result.id, result.internalNumber, { status: 'POSTED' }, { status: 'VOID', reversedById: user.id })
    return NextResponse.json({ success: true, invoiceId: result.id, status: result.status })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401
      : message === 'Insufficient permissions' ? 403
      : message === 'Purchase invoice not found' ? 404
      : ['Only a posted invoice can be reversed', 'The invoice ledger entry is missing; it cannot be safely reversed'].includes(message) ? 409
      : 500
    console.error('Purchase invoice reversal failed:', error)
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : status === 404 || status === 409 ? message : 'Failed to reverse purchase invoice' }, { status })
  }
}
