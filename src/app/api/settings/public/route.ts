import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get settings - there should only be one record
    let settings = await db.settings.findFirst({
      select: {
        currencySymbol: true,
        currencyCode: true,
        currencyName: true,
        decimalPlaces: true,
        thousandsSeparator: true,
        decimalSeparator: true,
        symbolPosition: true,
        dateFormat: true,
        timezone: true
      }
    })

    // Public reads should not create duplicate settings rows.
    if (!settings) {
      settings = {
        currencySymbol: '﷼',
        currencyCode: 'SAR',
        currencyName: 'Saudi Riyal',
        decimalPlaces: 2,
        thousandsSeparator: ',',
        decimalSeparator: '.',
        symbolPosition: 'before',
        dateFormat: 'DD/MM/YYYY',
        timezone: 'Asia/Riyadh'
      }
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching public settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}
