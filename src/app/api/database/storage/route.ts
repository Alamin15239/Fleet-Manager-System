import { NextRequest, NextResponse } from 'next/server'
import { db, controlDb, getOrganizationPrismaClient, getRequestOrganization } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type DatabaseSize = {
  databaseName: string
  bytes: number
  formatted: string
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`
}

function primaryProvider() {
  const configuredUrl = process.env.DATABASE_URL
  if (!configuredUrl) return 'POSTGRESQL'
  try {
    const host = new URL(configuredUrl).hostname.toLowerCase()
    if (host.includes('neon.tech')) return 'NEON'
    if (host.includes('prisma')) return 'PRISMA'
  } catch {
    // Keep the generic PostgreSQL label if the connection URL is not parseable.
  }
  return 'POSTGRESQL'
}

async function readDatabaseSize(client: { $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> }): Promise<DatabaseSize> {
  const rows = await client.$queryRaw`
    SELECT current_database() AS database_name,
           pg_database_size(current_database())::bigint AS size_bytes
  ` as Array<{ database_name: string; size_bytes: bigint | number | string }>
  const row = rows?.[0]
  if (!row) throw new Error('Database size query returned no result.')
  const bytes = Number(row.size_bytes)
  if (!Number.isFinite(bytes) || bytes < 0) throw new Error('Database size query returned an invalid size.')
  return { databaseName: row.database_name, bytes, formatted: formatBytes(bytes) }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    const organization = await getRequestOrganization()

    const countResults = await Promise.race([
      Promise.all([
        db.user.count(),
        db.truck.count(),
        db.trailer.count(),
        db.maintenanceRecord.count(),
        db.tire.count(),
        db.mechanic.count(),
        db.notification.count(),
        db.auditLog.count(),
        db.document.count()
      ]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Database operation timeout')), 8000))
    ])

    const [userCount, truckCount, trailerCount, maintenanceCount, tireCount, mechanicCount, notificationCount, auditLogCount, documentCount] = countResults
    let currentSize: DatabaseSize | null = null
    let currentSizeStatus: 'available' | 'unavailable' = 'unavailable'
    try {
      currentSize = await readDatabaseSize(db)
      currentSizeStatus = 'available'
    } catch (error) {
      console.error('Current organization database size query failed:', error)
    }

    const provider = organization.isPrimary
      ? primaryProvider()
      : (organization as typeof organization & { databaseProvider?: string }).databaseProvider || 'POSTGRESQL'
    const providerId = organization.isPrimary
      ? null
      : (organization as typeof organization & { neonProjectId?: string | null; prismaDatabaseId?: string | null }).neonProjectId
        || (organization as typeof organization & { prismaDatabaseId?: string | null }).prismaDatabaseId
        || null

    // The primary administrator can inspect the actual database size and provider
    // mapping for every registered organization. This list is discovered from the
    // registry each request, so newly provisioned organizations appear automatically.
    let organizations: Array<Record<string, unknown>> = []
    if (admin.isPrimaryOrganization) {
      const registered = await (controlDb as any).organization.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          isPrimary: true,
          databaseProvider: true,
          neonProjectId: true,
          prismaDatabaseId: true,
          schemaReady: true,
          encryptedDatabaseUrl: true
        }
      })
      const rows: Array<Record<string, unknown>> = []
      for (let offset = 0; offset < registered.length; offset += 5) {
        const batch = registered.slice(offset, offset + 5)
        const batchResults = await Promise.all(batch.map(async (item: any) => {
          const itemProvider = item.isPrimary ? primaryProvider() : (item.databaseProvider || 'POSTGRESQL')
          const result: Record<string, unknown> = {
            id: item.id,
            name: item.name,
            slug: item.slug,
            status: item.status,
            provider: itemProvider,
            providerDatabaseId: item.isPrimary ? null : (item.neonProjectId || item.prismaDatabaseId || null),
            databaseName: null,
            usedBytes: null,
            usedFormatted: null,
            storageStatus: 'unavailable'
          }
          if (item.status !== 'ACTIVE' || (!item.isPrimary && !item.encryptedDatabaseUrl)) {
            return result
          }
          try {
            const client = await getOrganizationPrismaClient(item)
            const size = await readDatabaseSize(client)
            return {
              ...result,
              databaseName: size.databaseName,
              usedBytes: size.bytes,
              usedFormatted: size.formatted,
              storageStatus: 'available'
            }
          } catch (error) {
            console.error(`Storage check failed for organization ${item.slug}:`, error)
            return result
          }
        }))
        rows.push(...batchResults)
      }
      organizations = rows
    }

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          isPrimary: organization.isPrimary,
          provider,
          providerDatabaseId: providerId,
          databaseName: currentSize?.databaseName ?? null
        },
        tableCounts: {
          users: userCount,
          trucks: truckCount,
          trailers: trailerCount,
          maintenance: maintenanceCount,
          tires: tireCount,
          mechanics: mechanicCount,
          notifications: notificationCount,
          auditLogs: auditLogCount,
          documents: documentCount,
          total: userCount + truckCount + trailerCount + maintenanceCount + tireCount + mechanicCount + notificationCount + auditLogCount + documentCount
        },
        storage: {
          actual: currentSize ? { ...currentSize } : null,
          actualStatus: currentSizeStatus,
          // PostgreSQL reports database size, but does not define a per-database
          // quota. Never manufacture a "remaining" number without a provider quota.
          quota: null,
          remainingBytes: null,
          remainingStatus: 'provider-quota-not-available'
        },
        organizations,
        timestamp: new Date().toISOString()
      }
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    console.error('Error fetching database storage info:', error)
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ success: false, error: 'Administrator access required' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Database operation timeout') {
      return NextResponse.json({ success: false, error: 'Database connection timeout. Please try again.' }, { status: 503 })
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch database storage information' }, { status: 500 })
  }
}
