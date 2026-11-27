export type PrimaryDatabaseEnvironment = Record<string, string | undefined>

/**
 * The central/control database is PostgreSQL on Prisma Postgres.
 * DATABASE_URL supplies the primary Prisma Postgres connection.
 */
export function getPrimaryDatabaseUrl(env: PrimaryDatabaseEnvironment = process.env): string {
  const url =
    env.STORAGE_DATABASE_URL_POOLED?.trim() ||
    env.STORAGE_DATABASE_URL?.trim() ||
    env.DATABASE_URL?.trim()
  if (!url) throw new Error('A Prisma Postgres connection is required (STORAGE_DATABASE_URL_POOLED or DATABASE_URL)')

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL')
  }

  return url
}


/** Identify the provider for the exact connection URL used by the control PrismaClient. */
export function getPrimaryDatabaseProvider(env: PrimaryDatabaseEnvironment = process.env): 'PRISMA' | 'NEON' | 'POSTGRESQL' {
  const url = getPrimaryDatabaseUrl(env)
  const hostname = new URL(url).hostname.toLowerCase()
  if (hostname.includes('prisma')) return 'PRISMA'
  if (hostname.includes('neon.tech')) return 'NEON'
  return 'POSTGRESQL'
}


/** Compare database identity across direct and pooled endpoints without exposing credentials. */
export function isSamePostgresDatabase(firstUrl: string, secondUrl: string): boolean {
  const first = new URL(firstUrl)
  const second = new URL(secondUrl)
  const normalizeHost = (host: string) => host.toLowerCase().replace(/^pooled\./, '').replace(/-pooler(?=\.)/, '')
  return normalizeHost(first.hostname) === normalizeHost(second.hostname) &&
    (first.pathname === second.pathname || (first.pathname === '/' && second.pathname === '/postgres') || (first.pathname === '/postgres' && second.pathname === '/')) &&
    first.username === second.username &&
    first.port === second.port
}
