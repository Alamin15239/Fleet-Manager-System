import { NextRequest, NextResponse } from 'next/server'
import { ensureOneDriveChangeSubscription } from '@/lib/onedrive-excel-sync'
import { captureOneDriveWorkbookChanges } from '@/lib/onedrive-excel-import'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const subscription = await ensureOneDriveChangeSubscription()
    const scan = subscription.enabled ? await captureOneDriveWorkbookChanges() : { scanned: 0, queued: 0, unchanged: true }
    return NextResponse.json({ success: true, subscription, scan })
  } catch (error) {
    console.error('OneDrive import watcher renewal failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not renew OneDrive watcher.' }, { status: 502 })
  }
}
