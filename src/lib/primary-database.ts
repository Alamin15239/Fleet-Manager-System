export type PrimaryDatabaseEnvironment = Record<string, string | undefined>

/**
 * The central/control database is PostgreSQL on Neon.
 * DATABASE_URL is supplied by the Vercel Neon integration.
 */
export function getPrimaryDatabaseUrl(env: PrimaryDatabaseEnvironment = process.env): string {
  const url = env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL is required for the primary Neon database')

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
