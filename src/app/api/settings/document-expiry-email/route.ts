import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

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

async function sendCatchUpSummary(emails: string[], resend: Resend) {
  const documents = await db.vehicleDocument.findMany({
    where: { validUntil: { not: null } },
    select: {
      title: true, documentType: true, validUntil: true,
      truck: { select: { licensePlate: true, make: true, model: true } },
      trailer: { select: { number: true } }, driver: { select: { name: true } },
      vehicle: { select: { vehicleNumber: true } },
    },
  })
  const todayKey = dateKeyInRiyadh()
  const today = Date.parse(todayKey + 'T00:00:00Z')
  const dueDocuments = documents.flatMap((document) => {
    if (!document.validUntil) return []
    const expiryKey = document.validUntil.toISOString().slice(0, 10)
    const daysLeft = Math.round((Date.parse(expiryKey + 'T00:00:00Z') - today) / 86400000)
    if (daysLeft > 30) return []
    const owner = document.truck ? 'Truck ' + document.truck.licensePlate + ' (' + [document.truck.make, document.truck.model].filter(Boolean).join(' ') + ')'
      : document.trailer ? 'Trailer ' + document.trailer.number
      : document.driver ? 'Driver ' + document.driver.name
      : document.vehicle ? 'Vehicle ' + document.vehicle.vehicleNumber : 'Fleet record'
    const timing = daysLeft > 0 ? 'expires in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's')
      : daysLeft === 0 ? 'expires today' : 'overdue by ' + Math.abs(daysLeft) + ' days'
    return [{ title: document.title, documentType: document.documentType, owner, expiryKey, daysLeft, timing }]
  }).sort((a, b) => a.daysLeft - b.daysLeft)

  if (!dueDocuments.length) return { count: 0, sent: false }
  const rows = dueDocuments.map((document) =>
    '<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + escapeHtml(document.title) +
    '<br><small>' + escapeHtml(document.documentType) + '</small></td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' +
    escapeHtml(document.owner) + '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + escapeHtml(document.expiryKey) +
    '</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">' + escapeHtml(document.timing) + '</td></tr>'
  ).join('')
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
    to: emails,
    subject: 'Fleet Manager Pro — existing document expiry alerts (' + dueDocuments.length + ')',
    html: '<div style="font-family:Arial,sans-serif;max-width:900px;margin:auto;color:#172033"><h2>Existing document expiry alerts</h2><p>These documents are already expired or due to expire within 30 days. Future daily summaries will continue automatically.</p><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr><th style="padding:8px">Document</th><th style="padding:8px">Vehicle / owner</th><th style="padding:8px">Expiry date</th><th style="padding:8px">Status</th></tr></thead><tbody>' + rows + '</tbody></table><p>Please renew expired or soon-to-expire documents and update Fleet Manager Pro.</p></div>',
  })
  if (error) throw new Error('Catch-up summary email failed')
  return { count: dueDocuments.length, sent: true }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })

    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Resend is not configured on the server.' }, { status: 503 })

    const existing = await db.settings.findFirst()
    const notifications = existing?.notifications && typeof existing.notifications === 'object'
      ? { ...(existing.notifications as Record<string, unknown>) }
      : {}
    const previousEmail = typeof notifications.documentExpiryEmail === 'string' ? notifications.documentExpiryEmail.split(/[;,\\n]+/).map((value) => value.trim().toLowerCase()).filter(Boolean).sort().join(',') : ''
    const previousVerified = notifications.documentExpiryEmailVerified === true
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
      to: emails,
      subject: 'Fleet Manager Pro — document expiry alert test',
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Document expiry alerts are connected</h2><p>This test confirms that Fleet Manager Pro can send document-expiry alerts to this address.</p><p>— Fleet Manager Pro</p></div>',
    })
    if (error) {
      console.error('Document expiry test email rejected by Resend')
      return NextResponse.json({ error: 'Resend could not send the test email. Check your verified sender/domain and Resend configuration.' }, { status: 502 })
    }

    notifications.documentExpiryEmail = emails.join(', ')
    notifications.documentExpiryEmailVerified = true
    notifications.documentExpiryEmailVerifiedAt = new Date().toISOString()
    if (previousEmail !== emails.slice().sort().join(',') || !previousVerified) {
      notifications.documentExpiryEmailSent = {}
      delete notifications.documentExpiryDigestDate
    }
    let settings = existing
      ? await db.settings.update({ where: { id: existing.id }, data: { notifications: notifications as any } })
      : await db.settings.create({ data: { notifications: notifications as any } })

    try {
      const catchUp = await sendCatchUpSummary(emails, resend)
      if (catchUp.sent) {
        const updatedNotifications = { ...(settings.notifications as Record<string, unknown>), documentExpiryDigestDate: dateKeyInRiyadh() }
        settings = await db.settings.update({
          where: { id: settings.id },
          data: { notifications: updatedNotifications as any },
        })
      }
      return NextResponse.json({
        success: true, email: emails.join(', '), emails, verified: true,
        message: catchUp.sent
          ? 'Test email sent and catch-up summary sent for ' + catchUp.count + ' existing document(s). Daily expiry summaries are enabled.'
          : 'Test email sent. No expired documents or documents due within 30 days were found. Daily expiry summaries are enabled.',
        catchUpCount: catchUp.count,
        notifications: settings.notifications,
      })
    } catch {
      console.error('Immediate document-expiry catch-up email failed; daily cron can retry')
      return NextResponse.json({
        success: true, email: emails.join(', '), emails, verified: true,
        message: 'Test email sent and alerts enabled, but the immediate catch-up summary could not be sent. The scheduled alert job will retry.',
        catchUpCount: null,
        notifications: settings.notifications,
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'No token provided' || message === 'Invalid token') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    console.error('Document expiry email setup failed')
    return NextResponse.json({ error: 'Could not configure document expiry alerts.' }, { status: 500 })
  }
}
