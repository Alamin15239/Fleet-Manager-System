import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { defaultPermissions, adminPermissions, managerPermissions } from '@/lib/permissions'
import { requireAdmin, requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database timeout')), 5000)
    )
    
    // Get settings - there should only be one record
    let settings = await Promise.race([
      db.settings.findFirst(),
      timeoutPromise
    ]) as any

    // If no settings exist, create default settings
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
          dateFormat: 'DD/MM/YYYY',
          maintenanceIntervals: {
            oilChange: 5000,
            tireRotation: 10000,
            brakeInspection: 15000,
            engineTuneUp: 30000,
            transmissionService: 60000
          },
          notifications: {
            email: true,
            upcomingMaintenance: true,
            overdueMaintenance: true,
            lowStock: false
          },
          rolePermissions: {
            ADMIN: adminPermissions,
            MANAGER: managerPermissions,
            USER: defaultPermissions
          } as unknown as Prisma.InputJsonValue,
          userPermissions: {}
        }
      })
    }

    if (user.role !== 'ADMIN') {
      const { bankName, bankAccountName, bankAccountNumber, bankIBAN, ...safeSettings } = settings
      return NextResponse.json(safeSettings)
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request)

    const body = await request.json()
    const {
      currencySymbol,
      currencyCode,
      currencyName,
      decimalPlaces,
      thousandsSeparator,
      decimalSeparator,
      symbolPosition,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      bankName,
      bankAccountName,
      bankAccountNumber,
      bankIBAN,
      acceptedPaymentMethods,
      timezone,
      dateFormat,
      maintenanceIntervals,
      notifications,
      rolePermissions,
      userPermissions
    } = body

    // Get existing settings
    let settings = await db.settings.findFirst()

    if (settings) {
      // Update existing settings
      settings = await db.settings.update({
        where: { id: settings.id },
        data: {
          currencySymbol,
          currencyCode,
          currencyName,
          decimalPlaces: parseInt(decimalPlaces),
          thousandsSeparator,
          decimalSeparator,
          symbolPosition,
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          bankName,
          bankAccountName,
          bankAccountNumber,
          bankIBAN,
          acceptedPaymentMethods,
          timezone,
          dateFormat,
          maintenanceIntervals,
          notifications,
          rolePermissions,
          userPermissions
        }
      })
    } else {
      // Create new settings
      settings = await db.settings.create({
        data: {
          currencySymbol,
          currencyCode,
          currencyName,
          decimalPlaces: parseInt(decimalPlaces),
          thousandsSeparator,
          decimalSeparator,
          symbolPosition,
          companyName,
          companyAddress,
          companyPhone,
          companyEmail,
          bankName,
          bankAccountName,
          bankAccountNumber,
          bankIBAN,
          acceptedPaymentMethods,
          timezone,
          dateFormat,
          maintenanceIntervals,
          notifications,
          rolePermissions,
          userPermissions
        }
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating settings:', error)
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Administrator access required' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
