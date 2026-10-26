import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { NotificationService } from '@/lib/notification-service'
import { controlDb, getPrimaryOrganization, withOrganization } from '@/lib/db'

export const runtime = 'nodejs'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
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
      id: true, title: true, documentType: true, validUntil: true,
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
    html: '<div style="font-family:Arial,sans-serif;max-width:900px;margin:auto;color:#172033"><h2>Fleet document expiry summary</h2><p>These documents are expired or due to expire within 30 days. This summary includes all matching records, not just specific reminder milestones.</p><p><b>Documents requiring attention:</b> ' + dueDocuments.length + '</p><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th style="padding:8px">Document</th><th style="padding:8px">Vehicle / owner</th><th style="padding:8px">Expiry date</th><th style="padding:8px">Status</th></tr></thead><tbody>' + rows + '</tbody></table><p>Please renew expired or soon-to-expire documents and update Fleet Manager Pro.</p></div>',
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
          return { ...notifications, documentExpiry }
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
