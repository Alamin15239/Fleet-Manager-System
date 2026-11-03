import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { db } from '@/lib/db'

interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked'
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    last_event?: string
  }
}


export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('RESEND_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
    }

    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: 'Missing webhook verification headers' }, { status: 400 })
    }

    // Resend uses Svix-standard signed headers and timestamp validation.
    const payload = await request.text()
    const svixHeaders = {
      id: svixId,
      timestamp: svixTimestamp,
      signature: svixSignature,
    }
    let event: ResendWebhookEvent
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      event = resend.webhooks.verify({
        payload,
        headers: svixHeaders,
        webhookSecret,
      }) as ResendWebhookEvent
    } catch {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }

    if (!event || typeof event.type !== 'string' || !event.data || typeof event.data.email_id !== 'string' || !Array.isArray(event.data.to)) {
      return NextResponse.json({ error: 'Invalid webhook event payload' }, { status: 400 })
    }
    
    console.log('Resend webhook received:', {
      type: event.type,
      emailId: event.data.email_id,
      to: event.data.to,
      subject: event.data.subject
    })

    // Store email event in database
    try {
      await db.emailLog.upsert({
        where: { eventId: svixId },
        create: {
          eventId: svixId,
          emailId: event.data.email_id,
          type: event.type,
          from: event.data.from,
          to: event.data.to.join(','),
          subject: event.data.subject,
          eventData: JSON.stringify(event.data),
          createdAt: new Date(event.created_at)
        },
        // Resend may retry the same webhook. The unique Svix event ID makes
        // processing idempotent without collapsing different events for one email.
        update: {}
      })
    } catch (dbError) {
      console.error('Failed to store email event:', dbError)
      // Continue processing even if DB fails
    }

    // Handle different event types
    switch (event.type) {
      case 'email.sent':
        console.log(`✅ Email sent: ${event.data.email_id}`)
        break
        
      case 'email.delivered':
        console.log(`📧 Email delivered: ${event.data.email_id}`)
        break
        
      case 'email.bounced':
        console.log(`❌ Email bounced: ${event.data.email_id}`)
        // Handle bounced email - maybe mark user email as invalid
        break
        
      case 'email.complained':
        console.log(`⚠️ Email complained: ${event.data.email_id}`)
        // Handle spam complaint - maybe unsubscribe user
        break
        
      case 'email.opened':
        console.log(`👀 Email opened: ${event.data.email_id}`)
        break
        
      case 'email.clicked':
        console.log(`🖱️ Email clicked: ${event.data.email_id}`)
        break
        
      case 'email.delivery_delayed':
        console.log(`⏳ Email delivery delayed: ${event.data.email_id}`)
        break
        
      default:
        console.log(`Unknown event type: ${event.type}`)
    }

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
