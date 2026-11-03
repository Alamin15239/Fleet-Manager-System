import { after, NextRequest, NextResponse } from 'next/server'
import { db, controlDb, getPrimaryOrganization, withOrganization } from '@/lib/db'
import { ensureOrganizationWorkbookIsolated } from '@/lib/onedrive-excel-sync'
import { captureOneDriveWorkbookChanges } from '@/lib/onedrive-excel-import'

export const runtime = 'nodejs'

type GraphNotification = { subscriptionId: string; clientState: string }

const MAX_NOTIFICATION_BODY_BYTES = 256 * 1024
const MAX_NOTIFICATIONS_PER_REQUEST = 100

async function readLimitedBody(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (declaredLength > MAX_NOTIFICATION_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('INVALID_PAYLOAD')
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_NOTIFICATION_BODY_BYTES) {
        await reader.cancel()
        throw new Error('PAYLOAD_TOO_LARGE')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

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
    const rawBody = await readLimitedBody(request)
    let body: { value?: unknown }
    try {
      body = JSON.parse(rawBody) as { value?: unknown }
    } catch {
      return NextResponse.json({ accepted: false, error: 'Invalid notification payload' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || !Array.isArray(body.value) || body.value.length === 0) {
      return NextResponse.json({ accepted: false, error: 'Notification list is required' }, { status: 400 })
    }
    if (body.value.length > MAX_NOTIFICATIONS_PER_REQUEST) {
      return NextResponse.json({ accepted: false, error: 'Too many notifications in one request' }, { status: 413 })
    }
    const notifications: GraphNotification[] = []
    for (const item of body.value) {
      if (!item || typeof item !== 'object') {
        return NextResponse.json({ accepted: false, error: 'Invalid notification entry' }, { status: 400 })
      }
      const notification = item as Record<string, unknown>
      if (typeof notification.subscriptionId !== 'string' || notification.subscriptionId.length === 0 || notification.subscriptionId.length > 256 ||
          typeof notification.clientState !== 'string' || notification.clientState.length === 0 || notification.clientState.length > 512) {
        return NextResponse.json({ accepted: false, error: 'Invalid notification verification fields' }, { status: 400 })
      }
      notifications.push({ subscriptionId: notification.subscriptionId, clientState: notification.clientState })
    }
    const organizationModel = (controlDb as any).organization
    const organizations = await organizationModel.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
    const targets = organizations.length ? organizations : [await getPrimaryOrganization()]

    after(async () => {
      for (const organization of targets) {
        try {
          await withOrganization(organization, async () => {
            await ensureOrganizationWorkbookIsolated()
            const integration = await db.oneDriveIntegration.findUnique({ where: { id: 'primary' } })
            const hasVerifiedNotification = notifications.some(notification =>
              notification.subscriptionId === integration?.graphSubscriptionId &&
              Boolean(integration?.graphSubscriptionClientState) &&
              notification.clientState === integration?.graphSubscriptionClientState
            )
            if (hasVerifiedNotification) await captureOneDriveWorkbookChanges()
          })
        } catch (error) {
          console.error('OneDrive workbook notification scan failed:', organization.slug, error instanceof Error ? error.message : 'Unknown error')
        }
      }
    })
    return NextResponse.json({ accepted: true }, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'PAYLOAD_TOO_LARGE') {
      return NextResponse.json({ accepted: false, error: 'Notification payload is too large' }, { status: 413 })
    }
    if (message === 'INVALID_PAYLOAD') {
      return NextResponse.json({ accepted: false, error: 'Notification payload is required' }, { status: 400 })
    }
    console.error('OneDrive workbook notification processing failed:', message || 'Unknown error')
    return NextResponse.json({ accepted: false, error: 'Workbook change scan failed; Microsoft may retry the notification.' }, { status: 503 })
  }
}
