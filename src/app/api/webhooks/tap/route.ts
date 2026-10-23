import { NextRequest, NextResponse } from 'next/server'
import { applyTapCharge, TapCharge, verifyTapWebhook } from '@/lib/organization-billing'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  let charge: TapCharge
  try {
    charge = await request.json() as TapCharge
  } catch {
    return NextResponse.json({ error: 'Invalid Tap webhook payload.' }, { status: 400 })
  }
  if (!verifyTapWebhook(charge, request.headers.get('hashstring'))) {
    return NextResponse.json({ error: 'Tap webhook verification failed.' }, { status: 401 })
  }

  try {
    await applyTapCharge(charge)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Tap subscription webhook processing failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Tap payment could not be applied yet.' }, { status: 500 })
  }
}
