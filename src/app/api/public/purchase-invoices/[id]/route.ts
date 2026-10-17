import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPurchaseInvoiceShareToken } from '@/lib/purchase-invoice-share'

export const dynamic = 'force-dynamic'

function asNumber(value: unknown) {
  if (value === null || value === undefined) return 0
  return Number(value)
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = request.nextUrl.searchParams.get('token') || ''
  if (!verifyPurchaseInvoiceShareToken(id, token)) {
    return NextResponse.json({ error: 'This invoice link is invalid' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const [invoice, company] = await Promise.all([
      db.purchaseInvoice.findUnique({
        where: { id },
        select: {
          internalNumber: true,
          vendorInvoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          isVatInvoice: true,
          pricesIncludeVat: true,
          vatRate: true,
          subtotal: true,
          vatTotal: true,
          grandTotal: true,
          status: true,
          notes: true,
          vendor: { select: { name: true, vatRegistration: true, phone: true, email: true, address: true } },
          lines: {
            select: {
              category: true,
              description: true,
              quantity: true,
              unitPrice: true,
              netAmount: true,
              vatAmount: true,
              totalAmount: true,
              truck: { select: { id: true, licensePlate: true, make: true, model: true } },
              trailer: { select: { id: true, number: true } },
            },
            orderBy: { lineNumber: 'asc' },
          },
        },
      }),
      db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } }),
    ])

    if (!invoice) return NextResponse.json({ error: 'Purchase invoice not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const serializedInvoice = {
      ...invoice,
      vatRate: asNumber(invoice.vatRate),
      subtotal: asNumber(invoice.subtotal),
      vatTotal: asNumber(invoice.vatTotal),
      grandTotal: asNumber(invoice.grandTotal),
      lines: invoice.lines.map((line) => ({
        ...line,
        quantity: asNumber(line.quantity),
        unitPrice: asNumber(line.unitPrice),
        netAmount: asNumber(line.netAmount),
        vatAmount: asNumber(line.vatAmount),
        totalAmount: asNumber(line.totalAmount),
      })),
    }
    return NextResponse.json({ invoice: serializedInvoice, company }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Public purchase-invoice lookup error:', error)
    return NextResponse.json({ error: 'Unable to load this invoice' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
