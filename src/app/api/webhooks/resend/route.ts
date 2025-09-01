import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
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

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const headersList = headers()
    const signature = headersList.get('resend-signature')
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('RESEND_WEBHOOK_SECRET not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    if (!signature) {
      console.error('Missing resend-signature header')
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const payload = await request.text()
    
    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event: ResendWebhookEvent = JSON.parse(payload)
    
    console.log('Resend webhook received:', {
      type: event.type,
      emailId: event.data.email_id,
      to: event.data.to,
      subject: event.data.subject
    })

    // Store email event in database
    try {
      await db.emailLog.create({
        data: {
          emailId: event.data.email_id,
          type: event.type,
          from: event.data.from,
          to: event.data.to.join(','),
          subject: event.data.subject,
          eventData: JSON.stringify(event.data),
          createdAt: new Date(event.created_at)
        }
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