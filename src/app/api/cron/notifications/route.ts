import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { NotificationService } from '@/lib/notification-service'
import { controlDb, getPrimaryOrganization, withOrganization } from '@/lib/db'

export const runtime = 'nodejs'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
}

async function documentShareUrl(db: any, document: { id: string; fileName?: string | null; shareToken?: string | null; shareExpiresAt?: Date | null }) {
  if (!document.fileName) return null
  let token = document.shareToken
  let expiresAt = document.shareExpiresAt
  if (!token || !expiresAt || expiresAt <= new Date()) {
    token = randomBytes(32).toString('hex')
    expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    await db.vehicleDocument.update({ where: { id: document.id }, data: { shareToken: token, shareExpiresAt: expiresAt } })
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '')
  return origin ? origin.replace(/\/$/, '') + '/api/public/documents/' + token : null
}

function dateKeyInRiyadh(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ''
  return part('year') + '-' + part('month') + '-' + part('day')
}

async function runDocumentExpiryEmailAlerts() {
  const { db } = await import('@/lib/db')
  const settings = await db.settings.findFirst()
  const notificationSettings = settings?.notifications && typeof settings.notifications === 'object'
    ? { ...(settings.notifications as Record<string, unknown>) } : {}
  const parseEmails = (value: unknown) => Array.from(new Set(typeof value === 'string' ? value.split(/[;,\n]+/).map((email) => email.trim().toLowerCase()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) : []))
  const recipients = parseEmails(notificationSettings.documentExpiryEmail)
  const ccRecipients = parseEmails(notificationSettings.documentExpiryEmailCc).filter((email) => !recipients.includes(email))
  const bccRecipients = parseEmails(notificationSettings.documentExpiryEmailBcc).filter((email) => !recipients.includes(email) && !ccRecipients.includes(email))
  if (!recipients.length || notificationSettings.documentExpiryEmailVerified !== true) return { status: 'disabled', sent: 0 }
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')

  const todayKey = dateKeyInRiyadh()
  if (notificationSettings.documentExpiryDigestDate === todayKey) {
    return { status: 'already-sent-today', sent: 0 }
  }

  const documents = await db.vehicleDocument.findMany({
    where: { validUntil: { not: null } },
    select: {
      id: true, title: true, documentType: true, validUntil: true, fileName: true, shareToken: true, shareExpiresAt: true,
      truck: { select: { licensePlate: true, make: true, model: true } },
      trailer: { select: { number: true } }, driver: { select: { name: true } },
      vehicle: { select: { vehicleNumber: true } },
    },
  })
  const today = Date.parse(todayKey + 'T00:00:00Z')
  const dueDocuments = documents.flatMap((document) => {
    if (!document.validUntil) return []
    const expiryKey = document.validUntil.toISOString().slice(0, 10)
    const daysLeft = Math.round((Date.parse(expiryKey + 'T00:00:00Z') - today) / 86400000)
    // Include all overdue documents and every document expiring in the next 30 days.
    if (daysLeft > 30) return []
    const owner = document.truck ? 'Truck ' + document.truck.licensePlate + ' (' + [document.truck.make, document.truck.model].filter(Boolean).join(' ') + ')'
      : document.trailer ? 'Trailer ' + document.trailer.number
      : document.driver ? 'Driver ' + document.driver.name
      : document.vehicle ? 'Vehicle ' + document.vehicle.vehicleNumber : 'Fleet record'
    const timing = daysLeft > 0 ? 'expires in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's')
      : daysLeft === 0 ? 'expires today' : 'overdue by ' + Math.abs(daysLeft) + ' days'
    return [{ title: document.title, documentType: document.documentType, owner, expiryKey, daysLeft, timing }]
  }).sort((a, b) => a.daysLeft - b.daysLeft)

  for (const document of dueDocuments as any[]) {
    document.shareUrl = await documentShareUrl(db, document)
  }

  if (!dueDocuments.length) {
    if (settings) await db.settings.update({
      where: { id: settings.id },
      data: { notifications: { ...notificationSettings, documentExpiryDigestDate: todayKey } as any },
    })
    return { status: 'no-current-alerts', sent: 0, checked: documents.length }
  }

  const rows = dueDocuments.map((document) =>
    '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + escapeHtml(document.title) +
    '<br><small>' + escapeHtml(document.documentType) + '</small></td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' +
    escapeHtml(document.owner) + '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + escapeHtml(document.expiryKey) +
    '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + escapeHtml(document.timing) + '</td></tr>'
  ).join('')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
    to: recipients,
    ...(ccRecipients.length ? { cc: ccRecipients } : {}),
    ...(bccRecipients.length ? { bcc: bccRecipients } : {}),
    subject: 'Fleet document expiry summary — ' + dueDocuments.length + ' document' + (dueDocuments.length === 1 ? '' : 's'),
    html: '<div style="font-family:Arial,sans-serif;max-width:900px;margin:auto;color:#172033"><h2>Fleet document expiry summary</h2><p>These documents are expired or due to expire within 30 days. This summary includes all matching records, not just specific reminder milestones.</p><p><b>Automatic notifications are now enabled:</b> From now on, this email address will receive automatic email notifications about document expirations, helping you renew documents before they expire. Please review the alerts and take action promptly.</p><p><b>Documents requiring attention:</b> ' + dueDocuments.length + '</p><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th style="padding:8px">Document</th><th style="padding:8px">Vehicle / owner</th><th style="padding:8px">Expiry date</th><th style="padding:8px">Status</th><th style="padding:8px">File</th></tr></thead><tbody>' + rows + '</tbody></table><p>Please renew expired or soon-to-expire documents and update Fleet Manager Pro.</p></div>',
  })
  if (error) {
    console.error('Resend rejected document-expiry summary')
    throw new Error('Resend rejected document-expiry summary')
  }
  if (settings) await db.settings.update({
    where: { id: settings.id },
    data: { notifications: { ...notificationSettings, documentExpiryDigestDate: todayKey } as any },
  })
  return { status: 'completed', sent: 1, checked: documents.length, included: dueDocuments.length }
}

async function runDocumentAndDriverChangeEmailAlerts() {
  const { db } = await import('@/lib/db')
  const settings = await db.settings.findFirst()
  const notificationSettings = settings?.notifications && typeof settings.notifications === 'object'
    ? { ...(settings.notifications as Record<string, unknown>) } : {}
  const parseEmails = (value: unknown) => Array.from(new Set(typeof value === 'string' ? value.split(/[;,\\n]+/).map((email) => email.trim().toLowerCase()).filter((email) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) : []))
  const recipients = parseEmails(notificationSettings.documentExpiryEmail)
  const ccRecipients = parseEmails(notificationSettings.documentExpiryEmailCc).filter((email) => !recipients.includes(email))
  const bccRecipients = parseEmails(notificationSettings.documentExpiryEmailBcc).filter((email) => !recipients.includes(email) && !ccRecipients.includes(email))
  if (!recipients.length || notificationSettings.documentExpiryEmailVerified !== true) return { status: 'disabled', sent: 0 }
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')

  const cutoff = new Date()
  const savedCursor = typeof notificationSettings.documentChangeEmailCursor === 'string'
    ? new Date(notificationSettings.documentChangeEmailCursor) : null
  const since = savedCursor && !Number.isNaN(savedCursor.getTime())
    ? savedCursor : new Date(cutoff.getTime() - 60 * 60 * 1000)

  const [documents, drivers] = await Promise.all([
    db.vehicleDocument.findMany({
      where: { updatedAt: { gt: since, lte: cutoff } },
      select: {
        id: true, title: true, documentType: true, validFrom: true, validUntil: true, updatedAt: true, fileName: true, shareToken: true, shareExpiresAt: true,
        truck: { select: { licensePlate: true } },
        trailer: { select: { number: true } },
        driver: { select: { name: true } },
        vehicle: { select: { vehicleNumber: true } },
      },
      orderBy: { updatedAt: 'asc' },
    }),
    db.driver.findMany({
      where: { updatedAt: { gt: since, lte: cutoff }, isDeleted: false },
      select: { id: true, name: true, phone: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: 'asc' },
    }),
  ])

  const documentsWithLinks = await Promise.all(documents.map(async document => ({ ...document, shareUrl: await documentShareUrl(db, document) })))
  const changes = [
    ...documentsWithLinks.map((document) => ({
      date: document.updatedAt.toISOString(),
      kind: 'Document added/edited',
      item: document.title || document.documentType,
      owner: document.driver ? 'Driver: ' + document.driver.name
        : document.truck ? 'Truck: ' + document.truck.licensePlate
        : document.trailer ? 'Trailer: ' + document.trailer.number
        : document.vehicle ? 'Vehicle: ' + document.vehicle.vehicleNumber : 'Fleet record',
      details: document.documentType + ' · issue: ' + (document.validFrom?.toISOString().slice(0, 10) || 'not set')
        + ' · expiry: ' + (document.validUntil?.toISOString().slice(0, 10) || 'not set'),
      shareUrl: document.shareUrl,
    })),
    ...drivers.map((driver) => ({
      date: driver.updatedAt.toISOString(),
      kind: driver.createdAt.getTime() === driver.updatedAt.getTime() ? 'Driver added' : 'Driver added/edited',
      item: driver.name,
      owner: 'Driver record',
      details: driver.phone ? 'Phone: ' + driver.phone : 'Driver details updated',
      shareUrl: null,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  if (!changes.length) {
    if (settings) await db.settings.update({
      where: { id: settings.id },
      data: { notifications: { ...notificationSettings, documentChangeEmailCursor: cutoff.toISOString() } as any },
    })
    return { status: 'no-changes', sent: 0, checkedDocuments: documents.length, checkedDrivers: drivers.length }
  }

  const rows = changes.map((change) =>
    '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + escapeHtml(change.kind) +
    '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + escapeHtml(change.item) +
    '<br><small>' + escapeHtml(change.details) + '</small></td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' +
    escapeHtml(change.owner) + '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' +
    escapeHtml(change.date.replace('T', ' ').slice(0, 16) + ' UTC') + '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + (change.shareUrl ? '<a href="' + change.shareUrl + '">View document</a><br><small>Link expires in 90 days</small>' : '—') + '</td></tr>'
  ).join('')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
    to: recipients,
    ...(ccRecipients.length ? { cc: ccRecipients } : {}),
    ...(bccRecipients.length ? { bcc: bccRecipients } : {}),
    subject: 'Fleet Manager: ' + changes.length + ' driver/document change' + (changes.length === 1 ? '' : 's'),
    html: '<div style="font-family:Arial,sans-serif;max-width:1000px;margin:auto;color:#172033"><h2>Fleet document and driver change summary</h2><p>The system detected the following driver records or documents added/edited since the previous hourly check. Driver cards are included.</p><p><b>Changes detected:</b> ' + changes.length + '</p><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th style="padding:8px">Change</th><th style="padding:8px">Record / details</th><th style="padding:8px">Owner</th><th style="padding:8px">Updated (UTC)</th><th style="padding:8px">File</th></tr></thead><tbody>' + rows + '</tbody></table><p>This is an automatic hourly summary from Fleet Manager.</p></div>',
  })
  if (error) {
    console.error('Resend rejected driver/document change summary')
    throw new Error('Resend rejected driver/document change summary')
  }
  if (settings) await db.settings.update({
    where: { id: settings.id },
    data: { notifications: { ...notificationSettings, documentChangeEmailCursor: cutoff.toISOString() } as any },
  })
  return { status: 'completed', sent: 1, changes: changes.length, documents: documents.length, drivers: drivers.length }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const organizationModel = (controlDb as any).organization
    const organizations = await organizationModel.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
    const targets = organizations.length ? organizations : [await getPrimaryOrganization()]
    const results = []
    const errors = []
    for (const organization of targets) {
      try {
        const result = await withOrganization(organization, async () => {
          const notifications = await NotificationService.runNotificationChecks()
          const documentExpiry = await runDocumentExpiryEmailAlerts()
          const documentAndDriverChanges = await runDocumentAndDriverChangeEmailAlerts()
          return { ...notifications, documentExpiry, documentAndDriverChanges }
        })
        results.push({ organization: organization.slug, ...result })
      } catch (error) {
        errors.push({ organization: organization.slug, error: error instanceof Error ? error.message : 'Notification checks failed' })
      }
    }
    return NextResponse.json({ success: errors.length === 0, organizations: results, errors }, { status: errors.length ? 207 : 200 })
  } catch (error) {
    console.error('Scheduled notification checks failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Scheduled notification checks failed.' }, { status: 500 })
  }
}
