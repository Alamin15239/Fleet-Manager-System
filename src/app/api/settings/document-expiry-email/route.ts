import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

function parseEmails(value: unknown) {
  return Array.from(new Set(
    typeof value === 'string'
      ? value.split(/[;,\n]+/).map((address) => address.trim().toLowerCase()).filter((address) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      : [],
  ))
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })

    const settings = await db.settings.findFirst()
    const notifications = settings?.notifications && typeof settings.notifications === 'object'
      ? settings.notifications as Record<string, unknown>
      : {}
    const to = parseEmails(notifications.documentExpiryEmail)
    const cc = parseEmails(notifications.documentExpiryEmailCc).filter((address) => !to.includes(address))
    const bcc = parseEmails(notifications.documentExpiryEmailBcc).filter((address) => !to.includes(address) && !cc.includes(address))
    if (!to.length) return NextResponse.json({ error: 'Save a primary recipient email address before sending a test.' }, { status: 400 })

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Resend is not configured on the server.' }, { status: 503 })

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
      to,
      ...(cc.length ? { cc } : {}),
      ...(bcc.length ? { bcc } : {}),
      subject: 'Fleet Manager Pro — document expiry alert test',
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Document expiry alert test</h2><p>This optional test confirms that Fleet Manager Pro can deliver email to the saved document-alert recipients.</p><p>Automatic document alerts are controlled by your saved recipient settings and scheduled notification checks.</p><p>— Fleet Manager Pro</p></div>',
    })
    if (error) return NextResponse.json({ error: 'Resend could not send the test email. Check your verified sender/domain and Resend configuration.' }, { status: 502 })

    return NextResponse.json({ success: true, message: 'Test email sent to the saved document-alert recipients.', email: to[0], cc, bcc })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'No token provided' || message === 'Invalid token') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    console.error('Document expiry test email failed')
    return NextResponse.json({ error: 'Could not send the document expiry test email.' }, { status: 500 })
  }
}
