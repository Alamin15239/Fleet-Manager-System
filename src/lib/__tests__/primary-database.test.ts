import { getPrimaryDatabaseUrl } from '@/lib/primary-database'

describe('getPrimaryDatabaseUrl', () => {
  const neon = 'postgresql://neon.example/db?sslmode=require'
  const tidb = 'postgresql://user:secret@gateway.pg.tidbcloud.com:5432/postgres?sslmode=require'

  it('keeps Neon as the default primary database', () => {
    expect(getPrimaryDatabaseUrl({ DATABASE_URL: neon })).toBe(neon)
  })

  it('selects TiDB only when explicitly enabled', () => {
    expect(getPrimaryDatabaseUrl({
      PRIMARY_DATABASE_PROVIDER: 'TIDB',
      TIDB_DATABASE_URL: tidb,
      DATABASE_URL: neon
    })).toBe(tidb)
  })

  it('rejects unknown primary database providers', () => {
    expect(() => getPrimaryDatabaseUrl({
      PRIMARY_DATABASE_PROVIDER: 'UNKNOWN',
      DATABASE_URL: neon
    })).toThrow('PRIMARY_DATABASE_PROVIDER must be NEON or TIDB')
  })

  it('requires the TiDB connection URL when TiDB is selected', () => {
    expect(() => getPrimaryDatabaseUrl({
      PRIMARY_DATABASE_PROVIDER: 'TIDB',
      DATABASE_URL: neon
    })).toThrow('TIDB_DATABASE_URL is required')
  })

  it('rejects non-TiDB hosts and connections without required TLS', () => {
    expect(() => getPrimaryDatabaseUrl({
      PRIMARY_DATABASE_PROVIDER: 'TIDB',
      TIDB_DATABASE_URL: 'postgresql://user:secret@neon.example/db?sslmode=require'
    })).toThrow('TiDB Cloud PostgreSQL endpoint')

    expect(() => getPrimaryDatabaseUrl({
      PRIMARY_DATABASE_PROVIDER: 'TIDB',
      TIDB_DATABASE_URL: 'postgresql://user:secret@gateway.pg.tidbcloud.com:5432/postgres'
    })).toThrow('sslmode=require')
  })
})
