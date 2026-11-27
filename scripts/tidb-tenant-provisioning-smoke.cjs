const { randomBytes } = require('node:crypto')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
const { Client } = require('pg')
const { PrismaClient } = require('@prisma/client')

function getAdminUrl() {
  const value = process.env.TIDB_DATABASE_URL?.trim()
  if (!value) throw new Error('TIDB_DATABASE_URL is required')
  const url = new URL(value)
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
    await admin.query('CREATE DATABASE "' + databaseName + '"')
    databaseCreated = true
    await admin.query('GRANT ALL PRIVILEGES ON DATABASE "' + databaseName + '" TO "' + roleName + '"')

    const schemaAdminUrl = new URL(adminUrl)
    schemaAdminUrl.pathname = '/' + databaseName
    const schemaAdmin = new Client({ connectionString: schemaAdminUrl.toString(), connectionTimeoutMillis: 5000 })
    await schemaAdmin.connect()
    try {
      await schemaAdmin.query('GRANT ALL PRIVILEGES ON SCHEMA public TO "' + roleName + '"')
    } finally {
      await schemaAdmin.end()
    }

    const tenantUrl = new URL(adminUrl)
    tenantUrl.pathname = '/' + databaseName
    tenantUrl.username = roleName
    tenantUrl.password = password

    tenant = new Client({ connectionString: tenantUrl.toString(), connectionTimeoutMillis: 5000 })
    await tenant.connect()
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
