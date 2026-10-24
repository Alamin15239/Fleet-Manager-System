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
  ownerPhone: string | null
  neonProjectId: string | null
  encryptedDatabaseUrl: string | null
  schemaReady: boolean
}

type NeonProjectResponse = {
  project?: { id?: string }
  connection_uris?: Array<{ connection_uri?: string }>
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
          phone: organization.ownerPhone,
          permissions: {}
        }
      })
    }
  } finally {
    await tenantDb.$disconnect()
  }
}

/** Provision one empty, isolated Neon database and its first organization admin. */
export async function provisionOrganization(organizationId: string) {
  const organizationModel = (controlDb as any).organization
  const organization = await organizationModel.findUnique({ where: { id: organizationId } }) as ProvisioningOrganization | null
  if (!organization) throw new Error('Organization not found')

  try {
    let connectionUri: string
    if (organization.encryptedDatabaseUrl && organization.neonProjectId) {
      connectionUri = decryptOrganizationDatabaseUrl(organization.encryptedDatabaseUrl)
    } else {
      // Validate before creating a billable external project so a missing or
      // malformed encryption key cannot orphan a database without a URI.
      encryptOrganizationDatabaseUrl('configuration-check')
      const project = await createNeonProject(organization)
      connectionUri = project.connectionUri
      await organizationModel.update({
        where: { id: organization.id },
        data: {
          neonProjectId: project.projectId,
          encryptedDatabaseUrl: encryptOrganizationDatabaseUrl(connectionUri)
        }
      })
    }

    if (!organization.schemaReady) {
      await applyDatabaseSchema(connectionUri)
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
