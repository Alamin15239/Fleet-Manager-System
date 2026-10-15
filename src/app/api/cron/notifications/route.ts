import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notification-service'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await NotificationService.runNotificationChecks()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Scheduled notification checks failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Scheduled notification checks failed.' }, { status: 500 })
  }
}
