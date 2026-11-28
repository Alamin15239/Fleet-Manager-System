import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { controlDb, db, getOrganizationPrismaClient, getPrimaryOrganization, withOrganization, type OrganizationRecord } from '@/lib/db'
import { migrateOrganizationStorage } from '@/lib/storage-migration'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const administrator = await requireAdmin(request)
    if (!administrator.isPrimaryOrganization) return NextResponse.json({ error: 'Primary organization administrator access required' }, { status: 403 })
    const body = await request.json().catch(() => ({})) as { execute?: boolean }
    const execute = body.execute === true
    const primary = await getPrimaryOrganization()
    const organizations = await controlDb.organization.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }) as OrganizationRecord[]
    if (!organizations.some(item => item.id === primary.id)) organizations.unshift(primary)
    const results = []
    for (const organization of organizations) {
      try {
        const client = organization.isPrimary ? controlDb : await getOrganizationPrismaClient(organization)
        const result = organization.isPrimary
          ? await migrateOrganizationStorage(client, organization.id || organization.slug, execute)
          : await withOrganization(organization, () => migrateOrganizationStorage(db, organization.id || organization.slug, execute))
        results.push({ organization: organization.slug, ...result })
      } catch (error) {
        results.push({ organization: organization.slug, scanned: 0, planned: 0, migrated: 0, skipped: 0, failed: 1, failures: [{ type: 'organization-database', id: organization.id, reason: error instanceof Error ? error.message.slice(0, 200) : 'Database unavailable' }], remaining: {} })
      }
    }
    const totals = results.reduce((sum, item) => ({ scanned: sum.scanned + item.scanned, planned: sum.planned + item.planned, migrated: sum.migrated + item.migrated, skipped: sum.skipped + item.skipped, failed: sum.failed + item.failed }), { scanned: 0, planned: 0, migrated: 0, skipped: 0, failed: 0 })
    return NextResponse.json({ success: totals.failed === 0, mode: execute ? 'migrate' : 'scan', totals, organizations: results, note: 'Run scan first. Execute only after confirming the planned records. Repeat until every remaining counter is zero.' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 503
    return NextResponse.json({ error: status === 503 ? 'Storage migration failed' : 'Access denied' }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
