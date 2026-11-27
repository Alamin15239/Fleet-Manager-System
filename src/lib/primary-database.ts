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
