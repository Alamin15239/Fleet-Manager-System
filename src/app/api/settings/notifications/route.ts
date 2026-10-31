import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { PermissionManager } from '@/lib/permissions'
import { Prisma } from '@prisma/client'

const notificationKeys = ['email', 'upcomingMaintenance', 'overdueMaintenance', 'lowStock'] as const

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const values = body?.notifications

    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return NextResponse.json({ error: 'Notification settings are required' }, { status: 400 })
    }

    const existingSettings = await db.settings.findFirst()
    if (user.role !== 'ADMIN') {
      const permissionManager = new PermissionManager(user.role, user.id, user.permissions)
      permissionManager.setSettingsPermissions({
        rolePermissions: (existingSettings?.rolePermissions || {}) as any,
        userPermissions: (existingSettings?.userPermissions || {}) as any
      })
      if (!permissionManager.canUpdate('settings')) {
        return NextResponse.json({ error: 'You do not have permission to change settings' }, { status: 403 })
      }
    }

    const current = existingSettings?.notifications && typeof existingSettings.notifications === 'object'
      ? existingSettings.notifications as Record<string, unknown>
      : {}
    const notifications = { ...current }

    for (const key of notificationKeys) {
      if (key in values) {
        if (typeof values[key] !== 'boolean') {
          return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 })
        }
        notifications[key] = values[key]
      }
    }
    const parseRecipientList = (value: unknown) => Array.from(new Set(
      String(value || '').split(/[;,\n]+/).map((address) => address.trim().toLowerCase()).filter(Boolean)
    ))
    if ('documentExpiryEmail' in values || 'documentExpiryEmailCc' in values || 'documentExpiryEmailBcc' in values) {
      if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Administrator access required to change document-alert recipients' }, { status: 403 })
      const primaryEmail = parseRecipientList(values.documentExpiryEmail)[0] || ''
      const ccEmails = parseRecipientList(values.documentExpiryEmailCc).filter((address) => address !== primaryEmail)
      const bccEmails = parseRecipientList(values.documentExpiryEmailBcc).filter((address) => address !== primaryEmail && !ccEmails.includes(address))
      const allRecipientEmails = [primaryEmail, ...ccEmails, ...bccEmails]
      const invalidRecipient = allRecipientEmails.find((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      if (invalidRecipient) {
        return NextResponse.json({ error: 'Enter valid document-alert recipient addresses. Invalid address: ' + invalidRecipient }, { status: 400 })
      }
      const canonical = (value: unknown) => parseRecipientList(value).sort().join(',')
      const oldKey = [current.documentExpiryEmail, current.documentExpiryEmailCc, current.documentExpiryEmailBcc].map(canonical).join('|')
      const newKey = [primaryEmail, ccEmails.join(','), bccEmails.join(',')].map(canonical).join('|')
      notifications.documentExpiryEmail = primaryEmail
      notifications.documentExpiryEmailCc = ccEmails.join(', ')
      notifications.documentExpiryEmailBcc = bccEmails.join(', ')
      notifications.documentExpiryEmailVerified = Boolean(primaryEmail)
      if (oldKey !== newKey) {
        delete notifications.documentExpiryDigestDate
        notifications.documentExpiryEmailSent = {}
      }
    }

    // No parts inventory source exists yet. Keep this option off rather than
    // creating misleading low-stock alerts from estimated usage.
    notifications.lowStock = false

    const saved = existingSettings
      ? await db.settings.update({ where: { id: existingSettings.id }, data: { notifications: notifications as Prisma.InputJsonValue } })
      : await db.settings.create({ data: { notifications: notifications as Prisma.InputJsonValue } })

    return NextResponse.json({ success: true, notifications: saved.notifications, updatedAt: saved.updatedAt })
  } catch (error) {
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error saving notification settings:', error)
    return NextResponse.json({ error: 'Failed to save notification settings' }, { status: 500 })
  }
}
