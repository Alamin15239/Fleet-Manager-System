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

    // If no settings exist, create default settings and return them
    if (!settings) {
      settings = await db.settings.create({
        data: {
          currencySymbol: '﷼',
          currencyCode: 'SAR',
          currencyName: 'Saudi Riyal',
          decimalPlaces: 2,
          thousandsSeparator: ',',
          decimalSeparator: '.',
          symbolPosition: 'before',
          timezone: 'Asia/Riyadh',
          dateFormat: 'DD/MM/YYYY'
        },
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