import { after, NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { captureOneDriveWorkbookChanges } from '@/lib/onedrive-excel-import'

export const runtime = 'nodejs'

type GraphNotification = { subscriptionId?: string; clientState?: string }

export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  if (!validationToken) return new NextResponse('Missing validation token', { status: 400 })
  return new NextResponse(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export async function POST(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  try {
    const body = await request.json() as { value?: GraphNotification[] }
    const notifications = Array.isArray(body.value) ? body.value : []
    const integration = await db.oneDriveIntegration.findUnique({ where: { id: 'primary' } })
    const verified = notifications.some(notification =>
      notification.subscriptionId === integration?.graphSubscriptionId &&
      Boolean(integration?.graphSubscriptionClientState) &&
      notification.clientState === integration?.graphSubscriptionClientState
    )
    if (!verified) return NextResponse.json({ accepted: false }, { status: 202 })

    after(async () => {
      try {
        await captureOneDriveWorkbookChanges()
      } catch (error) {
        console.error('OneDrive workbook notification scan failed:', error instanceof Error ? error.message : 'Unknown error')
      }
    })
    return NextResponse.json({ accepted: true }, { status: 202 })
  } catch (error) {
    console.error('OneDrive workbook notification processing failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ accepted: false, error: 'Workbook change scan failed; Microsoft may retry the notification.' }, { status: 503 })
  }
}
