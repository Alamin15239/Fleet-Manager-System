import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '@/lib/auth'
import { controlDb, decryptOrganizationDatabaseUrl, encryptOrganizationDatabaseUrl } from '@/lib/db'
import { defaultSettingsPermissions } from '@/lib/permissions'

type ProvisioningOrganization = {
  id: string
  name: string
  slug: string
  ownerName: string | null
  ownerEmail: string | null
  databaseProvider: string
  neonProjectId: string | null
  prismaDatabaseId: string | null
  encryptedDatabaseUrl: string | null
  schemaReady: boolean
}

type NeonProjectResponse = {
  project?: { id?: string }
  connection_uris?: Array<{ connection_uri?: string }>
}

export type OrganizationDatabaseProvider = 'NEON' | 'PRISMA'

type PrismaConnection = {
  endpoints?: {
    direct?: { connectionString?: string }
    pooled?: { connectionString?: string }
  }
}

type PrismaDatabase = {
  id?: string
  name?: string
  logicalId?: string
  status?: string
  project?: { id?: string }
  connections?: PrismaConnection[]
  pagination?: { nextCursor?: string | null; hasMore?: boolean }
}

function prismaApiToken() {
  const token = process.env.PRISMA_SERVICE_TOKEN
  if (!token) throw new Error('Prisma database provisioning is not configured (PRISMA_SERVICE_TOKEN)')
  return token
}

function prismaProjectId() {
  const projectId = process.env.PRISMA_PROJECT_ID?.trim()
  if (!projectId) throw new Error('Prisma database provisioning is not configured (PRISMA_PROJECT_ID)')
  return projectId
}

export function configuredOrganizationDatabaseProvider(): OrganizationDatabaseProvider {
  const provider = (process.env.ORGANIZATION_DATABASE_PROVIDER || 'NEON').trim().toUpperCase()
  if (provider !== 'NEON' && provider !== 'PRISMA') {
    throw new Error('ORGANIZATION_DATABASE_PROVIDER must be NEON or PRISMA')
  }
  return provider
}

function apiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const body = payload as { error?: { message?: string }; message?: string; detail?: string }
  return body.error?.message || body.message || body.detail || ''
}

async function prismaApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.prisma.io/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${prismaApiToken()}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    },
    cache: 'no-store'
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string }; message?: string }
  if (!response.ok) {
    const detail = apiErrorMessage(payload)
    throw new Error(`Prisma database API request failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`)
  }
  return payload
}

async function listPrismaProjectDatabases(projectId: string, logicalId: string) {
  let cursor: string | null = null
  for (let page = 0; page < 100; page++) {
    const query = new URLSearchParams({ limit: '100' })
    if (cursor) query.set('cursor', cursor)
    const result = await prismaApi<{ data?: PrismaDatabase[]; pagination?: { nextCursor?: string | null; hasMore?: boolean } }>(
      `/projects/${encodeURIComponent(projectId)}/databases?${query.toString()}`
    )
    const found = result.data?.find((database) => database.logicalId === logicalId)
    if (found?.id) return found
    if (!result.pagination?.hasMore || !result.pagination.nextCursor) return null
    cursor = result.pagination.nextCursor
  }
  throw new Error('Prisma has too many databases to safely find this organization workspace. Contact support before retrying setup.')
}

async function waitForPrismaDatabase(databaseId: string, initial?: PrismaDatabase) {
  let database = initial
  if (!database) throw new Error('Prisma did not return the requested organization database.')
  for (let attempt = 0; attempt < 20; attempt++) {
    if (database?.status === 'ready' || !database?.status) return database
    if (database.status === 'failure' || database.status === 'failed') {
      throw new Error('Prisma created the organization database but reported a failed status.')
    }
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1_500))
    const result = await prismaApi<{ data?: PrismaDatabase }>(`/databases/${encodeURIComponent(databaseId)}`)
    if (!result.data) throw new Error('Prisma did not return the requested organization database.')
    database = result.data
  }
  throw new Error('Prisma is still preparing the organization database. Retry setup in a moment.')
}

async function createPrismaConnection(database: PrismaDatabase, organization: ProvisioningOrganization) {
  if (!database.id) throw new Error('Prisma did not return an organization database ID.')
  const existing = database.connections?.find((connection) =>
    connection.endpoints?.pooled?.connectionString && connection.endpoints?.direct?.connectionString
  )
  if (existing?.endpoints?.pooled?.connectionString && existing.endpoints.direct?.connectionString) {
    return {
      connectionId: null,
      pooledConnectionUri: existing.endpoints.pooled.connectionString,
      directConnectionUri: existing.endpoints.direct.connectionString
    }
  }

  const connectionName = `fleet-manager-${organization.slug}`.slice(0, 65)
  const result = await prismaApi<{ data?: PrismaConnection & { id?: string; connectionString?: string } }>('/connections', {
    method: 'POST',
    body: JSON.stringify({ databaseId: database.id, name: connectionName })
  })
  const pooledConnectionUri = result.data?.endpoints?.pooled?.connectionString
  const directConnectionUri = result.data?.endpoints?.direct?.connectionString
  if (!pooledConnectionUri || !directConnectionUri) {
    throw new Error('Prisma did not return direct and pooled PostgreSQL connections. Check that PRISMA_PROJECT_ID points to a Prisma Postgres database.')
  }
  return { connectionId: result.data?.id || null, pooledConnectionUri, directConnectionUri }
}

async function createPrismaDatabase(organization: ProvisioningOrganization): Promise<{
  databaseId: string
  pooledConnectionUri: string
  directConnectionUri: string
}> {
  const projectId = prismaProjectId()
  const logicalId = `fleet-${organization.slug}-${organization.id}`.toLowerCase().replace(/[^a-z0-9._-]/g, '-')
  let database = await listPrismaProjectDatabases(projectId, logicalId)
  if (!database?.id) {
    const result = await prismaApi<{ data?: PrismaDatabase }>(
      `/projects/${encodeURIComponent(projectId)}/databases`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: `Fleet Manager - ${organization.slug}`,
          logicalId,
          region: process.env.PRISMA_DATABASE_REGION?.trim() || 'inherit',
          isDefault: false
        })
      }
    )
    database = result.data || null
  }
  if (!database?.id) throw new Error('Prisma did not return an organization database ID.')
  const readyDatabase = await waitForPrismaDatabase(database.id, database)
  const connection = await createPrismaConnection(readyDatabase, organization)
  return {
    databaseId: readyDatabase.id!,
    pooledConnectionUri: connection.pooledConnectionUri,
    directConnectionUri: connection.directConnectionUri
  }
}

async function createPrismaConnectionForExistingDatabase(databaseId: string, organization: ProvisioningOrganization) {
  const result = await prismaApi<{ data?: PrismaDatabase }>(`/databases/${encodeURIComponent(databaseId)}`)
  const database = await waitForPrismaDatabase(databaseId, result.data)
  if (!database.project?.id || database.project.id !== prismaProjectId()) {
    throw new Error('Prisma could not verify that the saved database belongs to the configured tenant project.')
  }
  return { databaseId, ...(await createPrismaConnection(database, organization)) }
}

export async function deletePrismaOrganizationDatabase(databaseId: string) {
  const projectId = prismaProjectId()
  const databaseResult = await prismaApi<{ data?: PrismaDatabase }>(`/databases/${encodeURIComponent(databaseId)}`)
    .catch((error) => {
      if (error instanceof Error && /HTTP 404\b/.test(error.message)) return null
      throw error
    })
  if (!databaseResult) return
  if (!databaseResult.data?.project?.id || databaseResult.data.project.id !== projectId) {
    throw new Error('Prisma could not verify that this database belongs to the configured tenant project; it was not deleted.')
  }
  const response = await fetch(`https://api.prisma.io/v1/databases/${encodeURIComponent(databaseId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${prismaApiToken()}`, Accept: 'application/json' },
    cache: 'no-store'
  })
  if (!response.ok && response.status !== 404) {
    throw new Error(`Prisma did not confirm deletion of this organization's database (HTTP ${response.status}).`)
  }
}

function directConnectionUrl(provider: OrganizationDatabaseProvider, connectionUri: string) {
  if (provider !== 'PRISMA') return connectionUri
  const url = new URL(connectionUri)
  if (url.hostname === 'pooled.db.prisma.io') url.hostname = 'db.prisma.io'
  if (url.hostname !== 'db.prisma.io') {
    throw new Error('The Prisma connection does not use the expected pooled PostgreSQL host.')
  }
  return url.toString()
}

function safeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Organization setup failed'
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[database connection]')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1[redacted]')
    .slice(0, 300)
}

async function createNeonProject(organization: ProvisioningOrganization): Promise<{ projectId: string; connectionUri: string }> {
  const apiKey = process.env.NEON_API_KEY
  if (!apiKey) throw new Error('Neon project provisioning is not configured (NEON_API_KEY)')

  const url = new URL('https://console.neon.tech/api/v2/projects')
  if (process.env.NEON_ORG_ID) url.searchParams.set('org_id', process.env.NEON_ORG_ID)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      project: {
        name: `Fleet Manager - ${organization.name}`.slice(0, 60),
        region_id: process.env.NEON_REGION_ID || 'aws-us-east-1',
        pg_version: 16
      }
    }),
    cache: 'no-store'
  })
  const payload = await response.json().catch(() => ({})) as NeonProjectResponse & { message?: string }
  const projectId = payload.project?.id
  const connectionUri = payload.connection_uris?.find((item) => item.connection_uri)?.connection_uri
  if (!response.ok) {
    if (/organization is managed by Vercel/i.test(payload.message || '')) {
      throw new Error('This Neon organization is managed by Vercel and blocks API project creation. Set NEON_API_KEY and NEON_ORG_ID to a Neon organization managed directly in Neon, redeploy, then retry setup.')
    }
    throw new Error(payload.message || `Neon project creation failed (${response.status})`)
  }
  if (!projectId || !connectionUri) {
    throw new Error('Neon created a project but did not return its database connection. Check the Neon project and try again.')
  }
  return { projectId, connectionUri }
}

async function applyDatabaseSchema(connectionUri: string) {
  const sqlPath = path.join(process.cwd(), 'prisma', 'organization-bootstrap.sql')
  const schemaSql = await readFile(sqlPath, 'utf8')
  let client: Client | null = null
  let lastError: unknown
  for (let attempt = 0; attempt < 10; attempt++) {
    // A pg Client is single-use: if a connection attempt fails, retry with a
    // fresh Client instead of calling connect() again on the same instance.
    const attemptClient = new Client({ connectionString: connectionUri, connectionTimeoutMillis: 3_000 })
    try {
      await attemptClient.connect()
      client = attemptClient
      break
    } catch (error) {
      lastError = error
      await attemptClient.end().catch(() => undefined)
      if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
  }
  if (!client) throw lastError instanceof Error ? lastError : new Error('Could not connect to the new organization database')

  try {
    const existingSchema = await client.query("SELECT to_regclass('public.users') IS NOT NULL AS ready")
    if (existingSchema.rows[0]?.ready) return
    await client.query('BEGIN')
    try {
      await client.query(schemaSql)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function seedOrganizationDatabase(organization: ProvisioningOrganization, connectionUri: string) {
  const tenantDb = new PrismaClient({
    log: ['error'],
    datasources: { db: { url: connectionUri } },
    transactionOptions: { timeout: 10_000, maxWait: 5_000 }
  })

  try {
    const settings = await tenantDb.settings.findFirst({ select: { id: true } })
    if (!settings) {
      await tenantDb.settings.create({
        data: {
          id: 'default',
          companyName: organization.name,
          currencySymbol: '﷼',
          currencyCode: 'SAR',
          currencyName: 'Saudi Riyal',
          timezone: 'Asia/Riyadh',
          dateFormat: 'DD/MM/YYYY',
          rolePermissions: defaultSettingsPermissions.rolePermissions as any,
          userPermissions: {}
        }
      })
    }

    const ownerEmail = organization.ownerEmail?.trim().toLowerCase()
    if (!ownerEmail) throw new Error('An organization administrator email is required')
    const existingOwner = await tenantDb.user.findFirst({
      where: { email: { equals: ownerEmail, mode: 'insensitive' } },
      select: { id: true }
    })
    if (!existingOwner) {
      await tenantDb.user.create({
        data: {
          email: ownerEmail,
          name: organization.ownerName?.trim() || ownerEmail,
          password: await hashPassword(randomBytes(32).toString('base64url')),
          role: 'ADMIN',
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          permissions: {}
        }
      })
    }
  } finally {
    await tenantDb.$disconnect()
  }
}

/** Provision one empty, isolated organization database and its first admin. */
export async function provisionOrganization(organizationId: string) {
  const organizationModel = (controlDb as any).organization
  const organization = await organizationModel.findUnique({ where: { id: organizationId } }) as ProvisioningOrganization | null
  if (!organization) throw new Error('Organization not found')

  try {
    const provider: OrganizationDatabaseProvider = organization.prismaDatabaseId
      ? 'PRISMA'
      : organization.neonProjectId
        ? 'NEON'
        : organization.encryptedDatabaseUrl
          ? (organization.databaseProvider === 'PRISMA' ? 'PRISMA' : 'NEON')
          : configuredOrganizationDatabaseProvider()
    let connectionUri: string
    let schemaConnectionUri: string | null = null
    if (organization.encryptedDatabaseUrl) {
      connectionUri = decryptOrganizationDatabaseUrl(organization.encryptedDatabaseUrl)
      if (provider === 'PRISMA') schemaConnectionUri = directConnectionUrl(provider, connectionUri)
    } else if (provider === 'PRISMA') {
      // Validate before creating billable external resources so missing crypto
      // configuration cannot leave an untracked database behind.
      encryptOrganizationDatabaseUrl('configuration-check')
      const prismaDatabase = organization.prismaDatabaseId
        ? await createPrismaConnectionForExistingDatabase(organization.prismaDatabaseId, organization)
        : await createPrismaDatabase(organization)
      connectionUri = prismaDatabase.pooledConnectionUri
      schemaConnectionUri = prismaDatabase.directConnectionUri
      await organizationModel.update({
        where: { id: organization.id },
        data: {
          databaseProvider: provider,
          prismaDatabaseId: prismaDatabase.databaseId,
          neonProjectId: null,
          encryptedDatabaseUrl: encryptOrganizationDatabaseUrl(connectionUri)
        }
      })
    } else {
      // Validate before creating a billable external project so a missing or
      // malformed encryption key cannot orphan a database without a URI.
      encryptOrganizationDatabaseUrl('configuration-check')
      const project = await createNeonProject(organization)
      connectionUri = project.connectionUri
      await organizationModel.update({
        where: { id: organization.id },
        data: {
          databaseProvider: provider,
          neonProjectId: project.projectId,
          prismaDatabaseId: null,
          encryptedDatabaseUrl: encryptOrganizationDatabaseUrl(connectionUri)
        }
      })
    }

    if (!organization.schemaReady) {
      await applyDatabaseSchema(schemaConnectionUri || connectionUri)
      await organizationModel.update({ where: { id: organization.id }, data: { schemaReady: true } })
    }

    await seedOrganizationDatabase(organization, connectionUri)
    await organizationModel.update({
      where: { id: organization.id },
      data: { status: 'ACTIVE', failureReason: null }
    })
  } catch (error) {
    const failureReason = safeFailure(error)
    await organizationModel.update({
      where: { id: organization.id },
      data: { status: 'FAILED', failureReason }
    }).catch(() => undefined)
    throw new Error(failureReason)
  }
}
