import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// PUT /api/settings/update - Update settings
export async function PUT(request: NextRequest) {
  try {
    await requireAuth(request)
    
    const body = await request.json()
    
    // Check if settings exist
    const existingSettings = await db.settings.findFirst()
    
    if (existingSettings) {
      // Update existing settings
      const updatedSettings = await db.settings.update({
        where: { id: existingSettings.id },
        data: {
          companyName: body.companyName,
          companyAddress: body.companyAddress,
          companyPhone: body.companyPhone,
          companyEmail: body.companyEmail,
          currencySymbol: body.currencySymbol,
          currencyCode: body.currencyCode,
          currencyName: body.currencyName,
          bankName: body.bankName,
          bankAccountName: body.bankAccountName,
          bankAccountNumber: body.bankAccountNumber,
          bankIBAN: body.bankIBAN,
          acceptedPaymentMethods: body.acceptedPaymentMethods,
        }
      })
      
      return NextResponse.json({ 
        message: 'Settings updated successfully',
        settings: updatedSettings 
      })
    } else {
      // Create new settings
      const newSettings = await db.settings.create({
        data: {
          companyName: body.companyName,
          companyAddress: body.companyAddress,
          companyPhone: body.companyPhone,
          companyEmail: body.companyEmail,
          currencySymbol: body.currencySymbol,
          currencyCode: body.currencyCode,
          currencyName: body.currencyName,
          bankName: body.bankName,
          bankAccountName: body.bankAccountName,
          bankAccountNumber: body.bankAccountNumber,
          bankIBAN: body.bankIBAN,
          acceptedPaymentMethods: body.acceptedPaymentMethods,
          decimalPlaces: 2,
          thousandsSeparator: ',',
          decimalSeparator: '.',
          symbolPosition: 'before',
          timezone: 'Asia/Riyadh',
          dateFormat: 'DD/MM/YYYY',
        }
      })
      
      return NextResponse.json({ 
        message: 'Settings created successfully',
        settings: newSettings 
      })
    }
  } catch (error) {
    console.error('Error updating settings:', error)
    if (error instanceof Error && (error.message === 'No token provided' || error.message === 'Invalid token')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}