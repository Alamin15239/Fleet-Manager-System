import { getPrimaryDatabaseProvider, getPrimaryDatabaseUrl, isSamePostgresDatabase } from '@/lib/primary-database'

describe('getPrimaryDatabaseUrl', () => {
  const prismaPooled = 'postgresql://pooled.prisma.example/db?sslmode=require'
  const prismaDirect = 'postgresql://direct.prisma.example/db?sslmode=require'
  const databaseUrl = 'postgresql://database.prisma.example/db?sslmode=require'

  it('prefers the pooled Prisma Postgres connection', () => {
    expect(getPrimaryDatabaseUrl({
      STORAGE_DATABASE_URL_POOLED: prismaPooled,
      STORAGE_DATABASE_URL: prismaDirect,
      DATABASE_URL: databaseUrl,
    })).toBe(prismaPooled)
  })

  it('falls back to the direct Prisma integration connection', () => {
    expect(getPrimaryDatabaseUrl({
      STORAGE_DATABASE_URL: prismaDirect,
      DATABASE_URL: databaseUrl,
    })).toBe(prismaDirect)
  })

  it('falls back to DATABASE_URL', () => {
    expect(getPrimaryDatabaseUrl({
      DATABASE_URL: databaseUrl,
    })).toBe(databaseUrl)
  })

  it('ignores obsolete provider variables', () => {
    expect(getPrimaryDatabaseUrl({
      DATABASE_URL: databaseUrl,
      PRIMARY_DATABASE_PROVIDER: 'NEON',
    })).toBe(databaseUrl)
  })

  it('requires a Prisma Postgres connection', () => {
    expect(() => getPrimaryDatabaseUrl({}))
      .toThrow('Prisma Postgres connection is required')
  })

  it('rejects malformed and non-PostgreSQL URLs', () => {
    expect(() => getPrimaryDatabaseUrl({
      DATABASE_URL: 'not-a-url',
    })).toThrow('valid PostgreSQL connection URL')

    expect(() => getPrimaryDatabaseUrl({
      DATABASE_URL: 'mysql://db.example/database',
    })).toThrow('PostgreSQL connection URL')
  })
})


describe('getPrimaryDatabaseProvider', () => {
  it('reports the provider selected by the same URL precedence as PrismaClient', () => {
    expect(getPrimaryDatabaseProvider({
      STORAGE_DATABASE_URL_POOLED: 'postgresql://pool.prisma-data.net/db',
      DATABASE_URL: 'postgresql://old.neon.tech/db',
    })).toBe('PRISMA')
  })

  it('reports Neon only when Neon is the selected connection', () => {
    expect(getPrimaryDatabaseProvider({
      DATABASE_URL: 'postgresql://ep-example.neon.tech/db',
    })).toBe('NEON')
  })
})


describe('isSamePostgresDatabase', () => {
  it('recognizes the same database across pooled and direct hostnames', () => {
    expect(isSamePostgresDatabase(
      'postgresql://db_user:secret@db-pooler.prisma-data.net:5432/postgres',
      'postgresql://db_user:secret@db.prisma-data.net:5432/postgres',
    )).toBe(true)
  })

  it('does not confuse separate Prisma databases sharing a gateway and database path', () => {
    expect(isSamePostgresDatabase(
      'postgresql://primary_db:secret@db.prisma-data.net:5432/postgres',
      'postgresql://tenant_db:secret@db.prisma-data.net:5432/postgres',
    )).toBe(false)
  })
})
