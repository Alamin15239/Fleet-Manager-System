import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const settings = await db.settings.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        currencySymbol: true,
        currencyCode: true,
        currencyName: true,
        decimalPlaces: true,
        thousandsSeparator: true,
        decimalSeparator: true,
        symbolPosition: true,
        companyName: true,
        companyAddress: true,
        companyPhone: true,
        companyEmail: true,
        acceptedPaymentMethods: true,
        timezone: true,
        dateFormat: true,
        maintenanceIntervals: true,
        notifications: true,
        rolePermissions: true,
        updatedAt: true,
      },
    })

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify({ format: 'fleet-manager-settings', exportedAt: new Date().toISOString(), settings }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="fleet-settings-${date}.json"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    console.error('Settings export failed:', error)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Settings export failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 503 },
    )
  }
}
