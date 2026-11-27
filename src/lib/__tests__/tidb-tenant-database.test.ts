import { buildTidbTenantConnectionUrl, buildTidbTenantDatabaseName, buildTidbTenantRoleName } from '@/lib/tidb-tenant-database'

describe('TiDB tenant database addressing', () => {
  const baseUrl = 'postgresql://tenant-user:secret@gateway01.us-east-1.prod.aws.pg.tidbcloud.com:5432/postgres?sslmode=require'

  it('creates a stable, bounded, SQL-safe database name per organization', () => {
    const first = buildTidbTenantDatabaseName('org_1234567890', 'Saad Freeh Transport')
    expect(first).toMatch(/^fleet_saad_freeh_transport_[a-f0-9]{12}$/)
    expect(first).toBe(buildTidbTenantDatabaseName('org_1234567890', 'Saad Freeh Transport'))
    expect(first).not.toBe(buildTidbTenantDatabaseName('org_different', 'Saad Freeh Transport'))
    expect(first.length).toBeLessThanOrEqual(63)
    expect(buildTidbTenantRoleName('org_1234567890', 'Saad Freeh Transport')).toMatch(/^fleet_saad_freeh_transport_[a-f0-9]{12}_app$/)
  })

  it('preserves the TiDB endpoint, credentials, and TLS while selecting the tenant database', () => {
    const name = buildTidbTenantDatabaseName('org_123', 'acme')
    const result = new URL(buildTidbTenantConnectionUrl(baseUrl, name, buildTidbTenantRoleName('org_123', 'acme'), 'tenant-password'))
    expect(result.pathname).toBe(`/${name}`)
    expect(result.username).toBe(buildTidbTenantRoleName('org_123', 'acme'))
    expect(result.password).toBe('tenant-password')
    expect(result.hostname).toBe('gateway01.us-east-1.prod.aws.pg.tidbcloud.com')
    expect(result.searchParams.get('sslmode')).toBe('require')
  })

  it('rejects unsafe database identifiers and non-TiDB or non-TLS URLs', () => {
    expect(() => buildTidbTenantConnectionUrl(baseUrl, 'postgres', 'unsafe', 'pass')).toThrow('Invalid TiDB tenant database identifier')
    expect(() => buildTidbTenantConnectionUrl('postgresql://user:pass@neon.example/db?sslmode=require', 'fleet_acme_0123456789ab', 'fleet_acme_0123456789ab_app', 'pass')).toThrow('TiDB Cloud PostgreSQL endpoint')
    expect(() => buildTidbTenantConnectionUrl('postgresql://user:pass@gateway01.us-east-1.prod.aws.pg.tidbcloud.com:5432/postgres', 'fleet_acme_0123456789ab', 'fleet_acme_0123456789ab_app', 'pass')).toThrow('sslmode=require')
  })
})
