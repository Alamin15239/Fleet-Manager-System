export type PrimaryDatabaseEnvironment = Record<string, string | undefined>

/**
 * Selects the central/control database without changing Prisma's schema-level
 * DATABASE_URL requirement. TiDB is opt-in so Neon remains the safe default
 * until the deployment environment explicitly enables the cutover.
 */
export function getPrimaryDatabaseUrl(env: PrimaryDatabaseEnvironment = process.env): string {
  const provider = (env.PRIMARY_DATABASE_PROVIDER || 'NEON').trim().toUpperCase()

  if (provider === 'NEON') {
    const url = env.DATABASE_URL?.trim()
    if (!url) throw new Error('DATABASE_URL is required for the primary Neon database')
    return url
  }

  if (provider !== 'TIDB') {
    throw new Error('PRIMARY_DATABASE_PROVIDER must be NEON or TIDB')
  }

  const url = env.TIDB_DATABASE_URL?.trim()
  if (!url) throw new Error('TIDB_DATABASE_URL is required when PRIMARY_DATABASE_PROVIDER=TIDB')

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('TIDB_DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !parsed.hostname.toLowerCase().endsWith('.tidbcloud.com')) {
    throw new Error('TIDB_DATABASE_URL must point to a TiDB Cloud PostgreSQL endpoint')
  }
  if (parsed.searchParams.get('sslmode') !== 'require') {
    throw new Error('TIDB_DATABASE_URL must include sslmode=require')
  }

  return url
}
