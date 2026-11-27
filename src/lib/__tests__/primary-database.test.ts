import { getPrimaryDatabaseUrl } from '@/lib/primary-database'

describe('getPrimaryDatabaseUrl', () => {
  const neon = 'postgresql://neon.example/db?sslmode=require'

  it('uses the Neon DATABASE_URL by default', () => {
    expect(getPrimaryDatabaseUrl({ DATABASE_URL: neon })).toBe(neon)
  })

  it('accepts a PostgreSQL URL when an obsolete provider variable is present', () => {
    expect(getPrimaryDatabaseUrl({
      DATABASE_URL: neon,
      PRIMARY_DATABASE_PROVIDER: 'NEON'
    })).toBe(neon)
  })

  it('requires DATABASE_URL', () => {
    expect(() => getPrimaryDatabaseUrl({})).toThrow('DATABASE_URL is required')
  })

  it('rejects malformed and non-PostgreSQL URLs', () => {
    expect(() => getPrimaryDatabaseUrl({ DATABASE_URL: 'not-a-url' })).toThrow('valid PostgreSQL connection URL')
    expect(() => getPrimaryDatabaseUrl({ DATABASE_URL: 'mysql://db.example/database' })).toThrow('PostgreSQL connection URL')
  })
})
