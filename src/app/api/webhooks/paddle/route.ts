import { NextRequest, NextResponse } from 'next/server'
import { applyPaddleWebhookEvent, verifyPaddleWebhook } from '@/lib/paddle-billing'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!verifyPaddleWebhook(rawBody, request.headers.get('paddle-signature'))) {
    return NextResponse.json({ error: 'Paddle webhook signature verification failed.' }, { status: 401 })
  }

  let event: { event_type?: unknown; data?: unknown }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid Paddle webhook payload.' }, { status: 400 })
  }
  if (typeof event.event_type !== 'string' || !event.data) {
    return NextResponse.json({ error: 'Paddle webhook event is incomplete.' }, { status: 400 })
  }

  try {
    const result = await applyPaddleWebhookEvent(event.event_type, event.data)
    return NextResponse.json({ received: true, result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Paddle subscription webhook processing failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Paddle payment could not be applied yet.' }, { status: 500 })
  }
}
