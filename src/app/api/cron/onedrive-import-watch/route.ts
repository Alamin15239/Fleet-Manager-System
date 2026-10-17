import { NextRequest, NextResponse } from 'next/server'
import { ensureOneDriveChangeSubscription } from '@/lib/onedrive-excel-sync'
import { captureOneDriveWorkbookChanges } from '@/lib/onedrive-excel-import'
import { controlDb, getPrimaryOrganization, withOrganization } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const organizationModel = (controlDb as any).organization
    const organizations = await organizationModel.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } })
    const targets = organizations.length ? organizations : [await getPrimaryOrganization()]
    const results = []
    const errors = []
    for (const organization of targets) {
      try {
        const result = await withOrganization(organization, async () => {
          const subscription = await ensureOneDriveChangeSubscription()
          const scan = subscription.enabled ? await captureOneDriveWorkbookChanges() : { scanned: 0, queued: 0, unchanged: true }
          return { subscription, scan }
        })
        results.push({ organization: organization.slug, ...result })
      } catch (error) {
        errors.push({ organization: organization.slug, error: error instanceof Error ? error.message : 'Workbook watcher renewal failed' })
      }
    }
    return NextResponse.json({ success: errors.length === 0, organizations: results, errors }, { status: errors.length ? 207 : 200 })
  } catch (error) {
    console.error('OneDrive import watcher renewal failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not renew OneDrive watcher.' }, { status: 502 })
  }
}
