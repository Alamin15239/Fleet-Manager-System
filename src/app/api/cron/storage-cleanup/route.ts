import { NextRequest, NextResponse } from 'next/server'
import { controlDb, getPrimaryOrganization, withOrganization } from '@/lib/db'
import { processPendingStorageObjectDeletions } from '@/lib/storage-cleanup'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const organizations = await (controlDb as any).organization.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    })
    const targets = organizations.length ? organizations : [await getPrimaryOrganization()]
    const results: Array<{ organization: string; claimed: number; deleted: number; retried: number }> = []
    const errors: Array<{ organization: string; error: string }> = []

    for (const organization of targets) {
      try {
        const result = await withOrganization(organization, () => processPendingStorageObjectDeletions(50, [organization.id, organization.slug, ...(organization.isPrimary ? ['primary'] : [])]))
        results.push({ organization: organization.slug, ...result })
      } catch (error) {
        errors.push({
          organization: organization.slug,
          error: error instanceof Error ? error.message : 'Storage cleanup failed',
        })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      organizations: results,
      errors,
      totals: results.reduce((total, item) => ({
        claimed: total.claimed + item.claimed,
        deleted: total.deleted + item.deleted,
        retried: total.retried + item.retried,
      }), { claimed: 0, deleted: 0, retried: 0 }),
    }, { status: errors.length ? 207 : 200 })
  } catch (error) {
    console.error('Storage cleanup cron failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not process private object cleanup.' }, { status: 502 })
  }
}
