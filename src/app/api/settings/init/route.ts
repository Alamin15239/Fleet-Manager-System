import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/settings/init - Initialize default settings
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    
    // Check if settings already exist
    const existingSettings = await db.settings.findFirst()
    
    if (existingSettings) {
      return NextResponse.json({ 
        message: 'Settings already exist',
        settings: existingSettings 
      })
    }
    
    // Create default settings
    const defaultSettings = await db.settings.create({
      data: {
        currencySymbol: '﷼',
        currencyCode: 'SAR',
        currencyName: 'Saudi Riyal',
        decimalPlaces: 2,
        thousandsSeparator: ',',
        decimalSeparator: '.',
        symbolPosition: 'before',
        companyName: 'Fleet Maintenance Services',
        companyAddress: 'Riyadh, Saudi Arabia',
        companyPhone: '+966 12 345 6789',
        companyEmail: 'info@fleetservices.com',
        timezone: 'Asia/Riyadh',
        dateFormat: 'DD/MM/YYYY',
        maintenanceIntervals: {
          oilChange: 5000,
          tireRotation: 10000,
          brakeInspection: 15000,
          generalService: 20000
        }
      }
    })
    
    return NextResponse.json({ 
      message: 'Default settings created successfully',
      settings: defaultSettings 
    })
  } catch (error) {
    console.error('Error initializing settings:', error)
    if (error instanceof Error && (error.message === 'No token provided' || error.message === 'Invalid token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}