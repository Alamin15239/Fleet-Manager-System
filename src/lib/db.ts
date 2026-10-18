import { AsyncLocalStorage } from 'node:async_hooks'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { headers } from 'next/headers'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export type OrganizationRecord = {
  id: string
  name: string
  slug: string
  status: 'PROVISIONING' | 'ACTIVE' | 'FAILED'
  isPrimary: boolean
  encryptedDatabaseUrl: string | null
  oneDriveAccountId: string | null
  oneDriveAccountEmailHash: string | null
}

type DatabaseScope = { organizationId: string; client: PrismaClient }

const globalForPrisma = globalThis as typeof globalThis & {
  fleetControlPrisma?: PrismaClient
  fleetOrganizationPrismas?: Map<string, PrismaClient>
}

const controlDb = globalForPrisma.fleetControlPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  datasources: { db: { url: process.env.DATABASE_URL } },
  errorFormat: 'pretty',
  transactionOptions: { timeout: 10000, maxWait: 5000 }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.fleetControlPrisma = controlDb

const tenantClients = globalForPrisma.fleetOrganizationPrismas ?? new Map<string, PrismaClient>()
if (process.env.NODE_ENV !== 'production') globalForPrisma.fleetOrganizationPrismas = tenantClients

const databaseScope = new AsyncLocalStorage<DatabaseScope>()

function getEncryptionKey(): Buffer {
  const configured = process.env.ORGANIZATION_DATABASE_ENCRYPTION_KEY
  if (!configured) throw new Error('Organization database encryption is not configured')
  const key = Buffer.from(configured, 'base64')
  if (key.length !== 32) throw new Error('Organization database encryption key must be 32 bytes (base64)')
  return key
}

export function encryptOrganizationDatabaseUrl(value: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptOrganizationDatabaseUrl(value: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = value.split('.')
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Stored organization database connection is invalid')
  }
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final()
  ]).toString('utf8')
}

export async function getPrimaryOrganization(): Promise<OrganizationRecord> {
  const organizationModel = (controlDb as any).organization
  let primary = await organizationModel.findFirst({ where: { isPrimary: true } }) as OrganizationRecord | null
  if (primary) return primary

  const settings = await controlDb.settings.findFirst({ select: { companyName: true } })
  const name = settings?.companyName?.trim() || 'Fleet Manager'
  const slug = (process.env.DEFAULT_ORGANIZATION_SLUG || name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'default-organization'

  try {
    primary = await organizationModel.create({
      data: { name, slug, status: 'ACTIVE', isPrimary: true }
    }) as OrganizationRecord
  } catch (error) {
    // Concurrent first logins can both try to seed the primary organization.
    primary = await organizationModel.findFirst({ where: { isPrimary: true } }) as OrganizationRecord | null
    if (!primary) throw error
  }
  return primary
}

export async function findOrganizationBySlug(slug?: string | null): Promise<OrganizationRecord> {
  if (!slug?.trim()) return getPrimaryOrganization()
  const normalizedSlug = slug.trim().toLowerCase()
  const organization = await (controlDb as any).organization.findUnique({ where: { slug: normalizedSlug } }) as OrganizationRecord | null
  if (!organization || organization.status !== 'ACTIVE') throw new Error('Organization was not found or is not ready')
  return organization
}

export async function findOrganizationById(id: string): Promise<OrganizationRecord> {
  const organization = await (controlDb as any).organization.findUnique({ where: { id } }) as OrganizationRecord | null
  if (!organization || organization.status !== 'ACTIVE') throw new Error('Organization was not found or is not ready')
  return organization
}

export class OneDriveAccountAlreadyConnectedError extends Error {
  constructor() {
    super('This Microsoft account is already connected to another organization.')
    this.name = 'OneDriveAccountAlreadyConnectedError'
  }
}

export class OneDriveAccountRegistryCheckError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OneDriveAccountRegistryCheckError'
  }
}

function hashOneDriveEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase()
  return normalized ? createHash('sha256').update(normalized).digest('hex') : null
}

type OneDriveAccountClaim = { oneDriveAccountId: string | null; oneDriveAccountEmailHash: string | null }

/** Atomically reserve one Microsoft account for a single organization. */
export async function claimOneDriveAccount(
  organizationId: string,
  microsoftAccountId: string,
  connectedEmail: string | null
): Promise<OneDriveAccountClaim> {
  const accountId = microsoftAccountId.trim()
  if (!accountId) throw new Error('Microsoft did not return a stable account ID.')
  const emailHash = hashOneDriveEmail(connectedEmail)
  const organizationModel = (controlDb as any).organization

  // Prefer the central reservation result before probing tenant databases. A
  // known duplicate should be reported even if an unrelated tenant is offline.
  const existingClaim = await organizationModel.findFirst({
    where: {
      id: { not: organizationId },
      OR: [
        { oneDriveAccountId: accountId },
        ...(emailHash ? [{ oneDriveAccountEmailHash: emailHash }] : [])
      ]
    },
    select: { id: true }
  })
  if (existingClaim) throw new OneDriveAccountAlreadyConnectedError()

  const activeOrganizations = await organizationModel.findMany({
    where: { status: 'ACTIVE', id: { not: organizationId } },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      isPrimary: true,
      encryptedDatabaseUrl: true,
      oneDriveAccountId: true,
      oneDriveAccountEmailHash: true
    }
  }) as OrganizationRecord[]

  // Existing connections predate the central claim registry. Check their
  // actual tenant records as well, so a legacy connection cannot be reused.
  for (const other of activeOrganizations) {
    let integration
    try {
      const tenantClient = await getOrganizationPrismaClient(other)
      integration = await tenantClient.oneDriveIntegration.findUnique({
        where: { id: 'primary' },
        select: { connectedEmail: true }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const reason = message.startsWith('An organization must use a database separate from the primary organization')
        ? 'an organization is configured to share the primary database'
        : /P2021|P2022/i.test(message)
          ? 'an organization database is missing the required OneDrive schema'
          : /P1001|P1002|P2024|ECONN|timed out/i.test(message)
            ? 'an organization database could not be reached'
            : 'an organization database check failed'
      throw new OneDriveAccountRegistryCheckError(
        `OneDrive account reuse could not be checked because ${reason}. Ask the platform administrator to repair the organization database setup, then try again.`
      )
    }
    if (emailHash && hashOneDriveEmail(integration?.connectedEmail) === emailHash) {
      throw new OneDriveAccountAlreadyConnectedError()
    }
  }

  return controlDb.$transaction(async (transaction) => {
    // Serialize account reservations by locking a stable registry row. The
    // advisory-lock function returns PostgreSQL `void`, which Prisma cannot
    // decode through $queryRaw; selecting the row ID keeps the lock result typed.
    const [registryLock] = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "organizations"
      WHERE "isPrimary" = TRUE
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE
    `
    if (!registryLock) throw new Error('The primary organization account registry lock is unavailable.')

    const txOrganizationModel = (transaction as any).organization
    const organization = await txOrganizationModel.findUnique({
      where: { id: organizationId },
      select: { id: true, oneDriveAccountId: true, oneDriveAccountEmailHash: true }
    }) as (OneDriveAccountClaim & { id: string }) | null
    if (!organization) throw new Error('Organization was not found.')

    const accountAlreadyClaimed = await txOrganizationModel.findFirst({
      where: {
        id: { not: organizationId },
        OR: [
          { oneDriveAccountId: accountId },
          ...(emailHash ? [{ oneDriveAccountEmailHash: emailHash }] : [])
        ]
      },
      select: { id: true }
    })
    if (accountAlreadyClaimed) throw new OneDriveAccountAlreadyConnectedError()

    await txOrganizationModel.update({
      where: { id: organizationId },
      data: { oneDriveAccountId: accountId, oneDriveAccountEmailHash: emailHash }
    })

    return {
      oneDriveAccountId: organization.oneDriveAccountId,
      oneDriveAccountEmailHash: organization.oneDriveAccountEmailHash
    }
  })
}

export async function restoreOneDriveAccountClaim(organizationId: string, claim: OneDriveAccountClaim) {
  await (controlDb as any).organization.update({
    where: { id: organizationId },
    data: claim
  })
}

export async function releaseOneDriveAccountClaim(organizationId: string) {
  await (controlDb as any).organization.update({
    where: { id: organizationId },
    data: { oneDriveAccountId: null, oneDriveAccountEmailHash: null }
  })
}

/** Resolve the organization selected by this authenticated request or active tenant scope. */
export async function getRequestOrganization(): Promise<OrganizationRecord> {
  const scoped = databaseScope.getStore()
  if (scoped) return findOrganizationById(scoped.organizationId)

  let authorization: string | null = null
  let organizationSlug: string | null = null
  try {
    const requestHeaders = await headers()
    authorization = requestHeaders.get('authorization')
    organizationSlug = requestHeaders.get('x-organization-slug')
  } catch {
    return getPrimaryOrganization()
  }

  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!bearerToken) {
    if (organizationSlug) throw new Error('Organization selection requires an authenticated login flow')
    return getPrimaryOrganization()
  }

  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  const decoded = jwt.verify(bearerToken, secret) as { organizationId?: string }
  return decoded.organizationId ? findOrganizationById(decoded.organizationId) : getPrimaryOrganization()
}

export async function getOrganizationPrismaClient(organization: OrganizationRecord): Promise<PrismaClient> {
  if (organization.status !== 'ACTIVE') throw new Error('Organization is not ready')
  if (organization.isPrimary) return controlDb
  if (!organization.encryptedDatabaseUrl) throw new Error('Organization database is not configured')

  const databaseUrl = decryptOrganizationDatabaseUrl(organization.encryptedDatabaseUrl)
  if (process.env.DATABASE_URL) {
    try {
      const tenantTarget = new URL(databaseUrl)
      const primaryTarget = new URL(process.env.DATABASE_URL)
      const tenantHost = tenantTarget.hostname.toLowerCase().replace(/-pooler(?=\.)/, '')
      const primaryHost = primaryTarget.hostname.toLowerCase().replace(/-pooler(?=\.)/, '')
      if (tenantHost === primaryHost && tenantTarget.pathname === primaryTarget.pathname) {
        throw new Error('An organization must use a database separate from the primary organization.')
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('An organization must use')) throw error
      // Let Prisma report malformed PostgreSQL URLs through its normal connection error.
    }
  }
  const cached = tenantClients.get(organization.id)
  if (cached) return cached

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
    datasources: { db: { url: databaseUrl } },
    transactionOptions: { timeout: 10000, maxWait: 5000 }
  })
  tenantClients.set(organization.id, client)
  return client
}

export async function withOrganization<T>(organization: OrganizationRecord, operation: () => Promise<T>): Promise<T> {
  const client = await getOrganizationPrismaClient(organization)
  return databaseScope.run({ organizationId: organization.id, client }, operation)
}

async function getRequestDatabaseClient(): Promise<PrismaClient> {
  const scoped = databaseScope.getStore()
  if (scoped) return scoped.client

  let authorization: string | null = null
  let organizationSlug: string | null = null
  try {
    const requestHeaders = await headers()
    authorization = requestHeaders.get('authorization')
    organizationSlug = requestHeaders.get('x-organization-slug')
  } catch {
    // Non-request contexts such as process shutdown use the primary database.
    return controlDb
  }

  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!bearerToken) {
    if (organizationSlug) throw new Error('Organization selection requires an authenticated login flow')
    return controlDb
  }

  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  const decoded = jwt.verify(bearerToken, secret) as { organizationId?: string }
  if (!decoded.organizationId) return controlDb

  const organization = await findOrganizationById(decoded.organizationId)
  return getOrganizationPrismaClient(organization)
}

// Existing code uses db.model.method throughout the API. This request-aware
// proxy routes those calls to the database selected by the verified JWT while
// preserving the generated PrismaClient type for existing consumers.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    if (property === 'then') return undefined
    if (typeof property !== 'string') return undefined

    if (property.startsWith('$')) {
      return (...args: unknown[]) => getRequestDatabaseClient().then((client) => {
        const method = (client as any)[property]
        return method.apply(client, args)
      })
    }

    return new Proxy({}, {
      get(_delegate, method) {
        if (method === 'then') return undefined
        if (typeof method !== 'string') return undefined
        return (...args: unknown[]) => getRequestDatabaseClient().then((client) => {
          const delegate = (client as any)[property]
          return delegate[method](...args)
        })
      }
    })
  }
})

export const prisma = db
export { controlDb }

export async function reconnectDB() {
  try {
    await controlDb.$disconnect()
    await new Promise(resolve => setTimeout(resolve, 1000))
    await controlDb.$connect()
    return true
  } catch (error) {
    console.error('DB reconnection failed:', error)
    return false
  }
}

process.on('beforeExit', async () => {
  await controlDb.$disconnect()
  await Promise.all([...tenantClients.values()].map(client => client.$disconnect()))
})
