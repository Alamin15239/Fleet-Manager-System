import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { EmailService } from '@/lib/email-service'
import { NotificationService } from '@/lib/notification-service'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const settings = await db.settings.findFirst()
    const notificationSettings = settings?.notifications as { email?: boolean } | null

    if (!notificationSettings?.email) {
      return NextResponse.json(
        { error: 'Save and enable email notifications before sending a test.' },
        { status: 409 }
      )
    }

    await EmailService.sendTestNotification(user.email, settings?.companyName)
    return NextResponse.json({ success: true, message: `Test notification sent to ${user.email}.` })
  } catch (error) {
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Test notification email failed:', error instanceof Error ? error.message : 'Unknown error')
    const message = error instanceof Error && error.message.includes('RESEND_API_KEY')
      ? 'Email delivery is not configured on the server.'
      : 'The test email could not be sent. Check the email delivery configuration and try again.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 })
    }
    const result = await NotificationService.runNotificationChecks()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Notification check failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not run notification checks' }, { status: 500 })
  }
}
