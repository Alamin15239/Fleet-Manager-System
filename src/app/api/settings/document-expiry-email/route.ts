import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

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
    const previousEmail = typeof notifications.documentExpiryEmail === 'string' ? notifications.documentExpiryEmail : ''
    const previousVerified = notifications.documentExpiryEmailVerified === true
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
      to: email,
      subject: 'Fleet Manager Pro — document expiry alert test',
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Document expiry alerts are connected</h2><p>This test confirms that Fleet Manager Pro can send document-expiry alerts to this address.</p><p>If you received this email, the address can now be used for scheduled document expiry reminders.</p><p>— Fleet Manager Pro</p></div>',
    })
    if (error) {
      console.error('Document expiry test email rejected by Resend')
      return NextResponse.json({ error: 'Resend could not send the test email. Check your verified sender/domain and Resend configuration.' }, { status: 502 })
    }

    notifications.documentExpiryEmail = email
    notifications.documentExpiryEmailVerified = true
    notifications.documentExpiryEmailVerifiedAt = new Date().toISOString()
    if (previousEmail !== email || !previousVerified) notifications.documentExpiryEmailSent = {}
    const settings = existing
      ? await db.settings.update({ where: { id: existing.id }, data: { notifications: notifications as any } })
      : await db.settings.create({ data: { notifications: notifications as any } })
    return NextResponse.json({ success: true, email, verified: true, message: 'Test email sent. Document expiry alerts are now enabled.', notifications: settings.notifications })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'No token provided' || message === 'Invalid token') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    console.error('Document expiry email setup failed')
    return NextResponse.json({ error: 'Could not configure document expiry alerts.' }, { status: 500 })
  }
}
