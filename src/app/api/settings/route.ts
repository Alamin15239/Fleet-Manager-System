import { NextRequest, NextResponse } from 'next/server'
import { db, controlDb } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { PermissionManager, defaultPermissions, adminPermissions, managerPermissions } from '@/lib/permissions'
import { requireAuth } from '@/lib/auth'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function GET(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'settings', 'read')
    
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

    const savedNotificationSettings = settings.notifications && typeof settings.notifications === 'object'
      ? settings.notifications as Record<string, unknown>
      : {}
    const responseSettings = {
      ...settings,
      notifications: {
        email: true,
        upcomingMaintenance: true,
        overdueMaintenance: true,
        ...savedNotificationSettings,
        // Spare-parts stock isn't recorded in the database, so don't advertise
        // a low-stock alert that cannot be calculated from actual inventory.
        lowStock: false
      }
    }

    if (user.role !== 'ADMIN') {
      const { bankName, bankAccountName, bankAccountNumber, bankIBAN, ...safeSettings } = responseSettings
      const storedUserPermissions = safeSettings.userPermissions && typeof safeSettings.userPermissions === 'object'
        ? safeSettings.userPermissions as Record<string, unknown>
        : {}
      safeSettings.userPermissions = Object.prototype.hasOwnProperty.call(storedUserPermissions, user.id)
        ? { [user.id]: storedUserPermissions[user.id] }
        : {}
      return NextResponse.json(safeSettings)
    }

    return NextResponse.json(responseSettings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'You do not have permission to view settings' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Resolve the caller's saved permissions before accepting an update. Admins
    // retain full access; other roles may edit ordinary settings only when an
    // Admin has granted the settings:update permission.
    const existingSettings = await db.settings.findFirst()
    const isAdmin = user.role === 'ADMIN'
    if (!isAdmin) {
      const permissionManager = new PermissionManager(user.role, user.id, user.permissions)
      permissionManager.setSettingsPermissions({
        rolePermissions: (existingSettings?.rolePermissions || {}) as any,
        userPermissions: (existingSettings?.userPermissions || {}) as any
      })
      if (!permissionManager.canUpdate('settings')) {
        return NextResponse.json(
          { error: 'You do not have permission to change settings' },
          { status: 403 }
        )
      }
    }

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

    const commonSettings = {
      currencySymbol,
      currencyCode,
      currencyName,
      decimalPlaces: Number.parseInt(String(decimalPlaces), 10),
      thousandsSeparator,
      decimalSeparator,
      symbolPosition,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      timezone,
      dateFormat,
      maintenanceIntervals,
      notifications
    }
    const adminOnlySettings = isAdmin
      ? {
          bankName,
          bankAccountName,
          bankAccountNumber,
          bankIBAN,
          acceptedPaymentMethods,
          rolePermissions,
          userPermissions
        }
      : {}
    const settingsData = { ...commonSettings, ...adminOnlySettings }

    let settings = existingSettings

    if (settings) {
      // Update existing settings
      settings = await db.settings.update({
        where: { id: settings.id },
        data: settingsData
      })
    } else {
      // Create new settings
      settings = await db.settings.create({
        data: settingsData
      })
    }

    if (user.organizationId && typeof companyName === 'string' && companyName.trim()) {
      await (controlDb as any).organization.update({
        where: { id: user.organizationId },
        data: { name: companyName.trim() }
      })
    }

    if (!isAdmin) {
      const { bankName, bankAccountName, bankAccountNumber, bankIBAN, ...safeSettings } = settings
      return NextResponse.json(safeSettings)
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
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
