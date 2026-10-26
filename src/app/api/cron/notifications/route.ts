import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { NotificationService } from '@/lib/notification-service'
import { controlDb, getPrimaryOrganization, withOrganization } from '@/lib/db'

export const runtime = 'nodejs'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
}

async function runDocumentExpiryEmailAlerts() {
  const { db } = await import('@/lib/db')
  const settings = await db.settings.findFirst()
  const notificationSettings = settings?.notifications && typeof settings.notifications === 'object'
    ? { ...(settings.notifications as Record<string, unknown>) } : {}
  const recipient = typeof notificationSettings.documentExpiryEmail === 'string' ? notificationSettings.documentExpiryEmail.trim() : ''
  if (!recipient || notificationSettings.documentExpiryEmailVerified !== true) return { status: 'disabled', sent: 0 }
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')
  const documents = await db.vehicleDocument.findMany({
    where: { validUntil: { not: null } },
    select: {
      id: true, title: true, documentType: true, validUntil: true,
      truck: { select: { licensePlate: true, make: true, model: true } },
      trailer: { select: { number: true } }, driver: { select: { name: true } },
      vehicle: { select: { vehicleNumber: true } },
    },
  })
  const sentMap = notificationSettings.documentExpiryEmailSent && typeof notificationSettings.documentExpiryEmailSent === 'object'
    ? { ...(notificationSettings.documentExpiryEmailSent as Record<string, string>) } : {}
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0
  for (const document of documents) {
    if (!document.validUntil) continue
    const expiry = document.validUntil
    const daysLeft = Math.round((Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate()) - today) / 86400000)
    let stage: string | null = [30, 14, 7, 1, 0].includes(daysLeft) ? 'due-' + daysLeft : null
    if (daysLeft < 0 && Math.abs(daysLeft) % 7 === 0) stage = 'overdue-' + Math.abs(daysLeft)
    if (!stage) continue
    const key = document.id + ':' + expiry.toISOString().slice(0, 10) + ':' + stage
    if (sentMap[key]) continue
    const owner = document.truck ? 'Truck ' + document.truck.licensePlate + ' (' + document.truck.make + ' ' + document.truck.model + ')'
      : document.trailer ? 'Trailer ' + document.trailer.number
      : document.driver ? 'Driver ' + document.driver.name
      : document.vehicle ? 'Vehicle ' + document.vehicle.vehicleNumber : 'Fleet record'
    const timing = daysLeft > 0 ? 'expires in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's')
      : daysLeft === 0 ? 'expires today' : 'is overdue by ' + Math.abs(daysLeft) + ' days'
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
      to: recipient,
      subject: 'Document expiry alert: ' + document.title + ' — ' + timing,
      html: '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033"><h2>Fleet document expiry alert</h2><p><strong>' + escapeHtml(document.title) + '</strong> (' + escapeHtml(document.documentType) + ') ' + timing + '.</p><p><b>Vehicle / owner:</b> ' + escapeHtml(owner) + '</p><p><b>Expiry date:</b> ' + expiry.toISOString().slice(0, 10) + '</p><p>Please renew the document and update its expiry date in Fleet Manager Pro.</p></div>',
    })
    if (error) {
      console.error('Resend rejected a document-expiry alert', { documentId: document.id, stage })
      continue
    }
    sentMap[key] = new Date().toISOString()
    sent += 1
  }
  if (settings) await db.settings.update({
    where: { id: settings.id },
    data: { notifications: { ...notificationSettings, documentExpiryEmailSent: sentMap } as any },
  })
  return { status: 'completed', sent, checked: documents.length }
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
