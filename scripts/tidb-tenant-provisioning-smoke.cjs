const { randomBytes } = require('node:crypto')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const { Client } = require('pg')
const { PrismaClient } = require('@prisma/client')

function getAdminUrl() {
  const value = process.env.TIDB_DATABASE_URL?.trim()
  if (!value) throw new Error('TIDB_DATABASE_URL is required')
  if (value.startsWith('\\')) {
    throw new Error('TIDB_DATABASE_URL begins with a literal backslash. Store the raw PostgreSQL URL without a leading backslash.')
  }
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    throw new Error('TIDB_DATABASE_URL is wrapped in quotes. Store the raw URL without surrounding quotes.')
  }
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    const safePrefix = value.slice(0, 16).replace(/[^a-zA-Z:/._-]/g, '?')
    throw new Error('TIDB_DATABASE_URL is not a PostgreSQL URL (safe prefix: ' + safePrefix + '). Expected postgresql:// or postgres://.')
  }
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('TIDB_DATABASE_URL has a PostgreSQL scheme but is not a valid URL. Check URI encoding of username/password and URL delimiters; credentials were not logged.')
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname.toLowerCase().endsWith('.tidbcloud.com') ||
      url.searchParams.get('sslmode') !== 'require') {
    throw new Error('TIDB_DATABASE_URL must be a TLS-enabled TiDB Cloud PostgreSQL URL')
  }
  return url
}

async function main() {
  const adminUrl = getAdminUrl()
  const suffix = randomBytes(6).toString('hex')
  const databaseName = 'fleet_smoke_' + suffix
  const roleName = databaseName + '_app'
  const password = randomBytes(32).toString('base64url')
  const admin = new Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5000 })
  let adminConnected = false
  let cleanupFailed = false
  let roleCreated = false
  let databaseCreated = false
  let tenant = null
  let prisma = null

  try {
    await admin.connect()
    adminConnected = true
    await admin.query('CREATE ROLE "' + roleName + '" LOGIN PASSWORD \'' + password + '\'')
    roleCreated = true

    const roleResult = await admin.query(
      'SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname = $1',
      [roleName]
    )
    if (roleResult.rowCount !== 1 || roleResult.rows[0].rolcanlogin !== true) {
      throw new Error('TiDB created the tenant role without the expected LOGIN attribute')
    }

    await admin.query('CREATE DATABASE "' + databaseName + '"')
    databaseCreated = true
    const schemaAdminUrl = new URL(adminUrl)
    schemaAdminUrl.pathname = '/' + databaseName
    const schemaAdmin = new Client({ connectionString: schemaAdminUrl.toString(), connectionTimeoutMillis: 5000 })
    await schemaAdmin.connect()
    try {
      await schemaAdmin.query('GRANT USAGE, CREATE ON SCHEMA public TO "' + roleName + '"')
    } finally {
      await schemaAdmin.end()
    }

    const tenantUrl = new URL(adminUrl)
    tenantUrl.pathname = '/' + databaseName
    tenantUrl.username = roleName
    tenantUrl.password = password

    // Use explicit pg fields for the role-authentication test, avoiding URL credential parsing.
    tenant = new Client({
      host: adminUrl.hostname,
      port: Number(adminUrl.port || 5432),
      database: databaseName,
      user: roleName,
      password,
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 5000
    })
    try {
      await tenant.connect()
    } catch (error) {
      throw new Error(
        'TiDB reports the tenant role exists with LOGIN=true, but direct PostgreSQL authentication failed (' +
        (error.code || 'no SQLSTATE') + '). This isolates the failure to TiDB role-password authentication, not URL parsing or role creation.'
      )
    }

    const schemaSql = await readFile(path.join(process.cwd(), 'prisma', 'organization-bootstrap.sql'), 'utf8')
    await tenant.query('BEGIN')
    try {
      await tenant.query(schemaSql)
      await tenant.query('COMMIT')
    } catch (error) {
      await tenant.query('ROLLBACK').catch(() => undefined)
      throw error
    }
    await tenant.end()
    tenant = null

    prisma = new PrismaClient({ log: ['error'], datasources: { db: { url: tenantUrl.toString() } } })
    await prisma.$connect()
    const [users, trucks, trailers, settings] = await Promise.all([
      prisma.user.count(),
      prisma.truck.count(),
      prisma.trailer.count(),
      prisma.settings.count()
    ])
    if (users !== 0 || trucks !== 0 || trailers !== 0 || settings !== 0) {
      throw new Error('Fresh TiDB tenant database unexpectedly contains application rows')
    }
    console.log('TiDB tenant provisioning smoke test passed: isolated role login, database creation, full tenant schema bootstrap, and Prisma reads.')
  } finally {
    await prisma?.$disconnect().catch(() => undefined)
    await tenant?.end().catch(() => undefined)
    if (adminConnected) {
      if (databaseCreated) {
        await admin.query('DROP DATABASE "' + databaseName + '"').catch((error) => {
          cleanupFailed = true
          console.error('Cleanup warning: could not drop temporary smoke database:', error.message)
        })
      }
      if (roleCreated) {
        await admin.query('DROP ROLE "' + roleName + '"').catch((error) => {
          cleanupFailed = true
          console.error('Cleanup warning: could not drop temporary smoke role:', error.message)
        })
      }
    }
    await admin.end().catch(() => undefined)
    if (cleanupFailed) process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('TiDB tenant provisioning smoke test failed:', error.message)
  process.exitCode = 1
})
