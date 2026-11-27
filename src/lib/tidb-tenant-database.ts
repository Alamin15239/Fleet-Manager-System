import { createHash } from 'node:crypto'

const TENANT_DATABASE_PATTERN = /^fleet_[a-z0-9_]+_[a-f0-9]{12}$/

/** Stable, SQL-identifier-safe database name for one organization. */
export function buildTidbTenantRoleName(organizationId: string, organizationSlug: string): string {
  return `${buildTidbTenantDatabaseName(organizationId, organizationSlug)}_app`.slice(0, 63)
}

export function buildTidbTenantDatabaseName(organizationId: string, organizationSlug: string): string {
  const slug = organizationSlug
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'organization'
  const suffix = createHash('sha256').update(organizationId).digest('hex').slice(0, 12)
  return `fleet_${slug}_${suffix}`
}

/** Build a tenant URL from the TiDB control connection without changing credentials or TLS. */
export function buildTidbTenantConnectionUrl(baseConnectionUrl: string, databaseName: string, username: string, password: string): string {
  if (!TENANT_DATABASE_PATTERN.test(databaseName)) {
    throw new Error('Invalid TiDB tenant database identifier')
  }

  let url: URL
  try {
    url = new URL(baseConnectionUrl)
  } catch {
    throw new Error('TIDB_DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname.toLowerCase().endsWith('.tidbcloud.com')) {
    throw new Error('TIDB_DATABASE_URL must point to a TiDB Cloud PostgreSQL endpoint')
  }
  if (url.searchParams.get('sslmode') !== 'require') {
    throw new Error('TIDB_DATABASE_URL must include sslmode=require')
  }

  if (!/^fleet_[a-z0-9_]+_[a-f0-9]{12}_app$/.test(username) || !password) {
    throw new Error('Invalid TiDB tenant database credentials')
  }

  url.pathname = `/${databaseName}`
  url.username = username
  url.password = password
  return url.toString()
}
