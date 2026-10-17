import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notification-service'
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
        const result = await withOrganization(organization, () => NotificationService.runNotificationChecks())
        results.push({ organization: organization.slug, ...result })
      } catch (error) {
        errors.push({ organization: organization.slug, error: error instanceof Error ? error.message : 'Notification checks failed' })
      }
    }
    return NextResponse.json({ success: errors.length === 0, organizations: results, errors }, { status: errors.length ? 207 : 200 })
  } catch (error) {
    console.error('Scheduled notification checks failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Scheduled notification checks failed.' }, { status: 500 })
  }
}
