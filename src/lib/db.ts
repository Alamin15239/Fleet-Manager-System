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
  billingProvider?: string | null
  billingStatus?: string | null
  billingGraceUntil?: Date | null
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

// Tenant databases created before fleet planning was introduced are upgraded
// lazily the first time one of the new Prisma models is used. The DDL is
// idempotent so separate serverless instances can safely race on first use.
const fleetPlanningModels = new Set(['vehicleType', 'fleetVehicle', 'vehicleDocument', 'maintenanceType', 'driver'])
const fleetPlanningMigrations = new WeakMap<PrismaClient, Promise<void>>()

async function ensureFleetPlanningSchema(client: PrismaClient) {
  const existing = fleetPlanningMigrations.get(client)
  if (existing) return existing
  const migration = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS "vehicle_types" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "vehicle_types_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_types_name_key" ON "vehicle_types"("name")`,
      `CREATE TABLE IF NOT EXISTS "drivers" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "normalizedName" TEXT NOT NULL, "phone" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "isDeleted" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "drivers_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "drivers_normalizedName_key" ON "drivers"("normalizedName")`,
      `CREATE INDEX IF NOT EXISTS "drivers_name_idx" ON "drivers"("name")`,
      `CREATE TABLE IF NOT EXISTS "fleet_vehicles" ("id" TEXT NOT NULL, "vehicleNumber" TEXT NOT NULL, "vehicleTypeId" TEXT NOT NULL, "vin" TEXT, "registrationNo" TEXT, "make" TEXT, "model" TEXT, "year" INTEGER, "currentMileage" INTEGER, "engineHours" INTEGER, "driverName" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "fleet_vehicles_pkey" PRIMARY KEY ("id"), CONSTRAINT "fleet_vehicles_vehicleTypeId_fkey" FOREIGN KEY ("vehicleTypeId") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "fleet_vehicles_vehicleNumber_key" ON "fleet_vehicles"("vehicleNumber")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "fleet_vehicles_vin_key" ON "fleet_vehicles"("vin")`,
      `CREATE INDEX IF NOT EXISTS "fleet_vehicles_vehicleTypeId_idx" ON "fleet_vehicles"("vehicleTypeId")`,
      `CREATE INDEX IF NOT EXISTS "fleet_vehicles_status_idx" ON "fleet_vehicles"("status")`,
      `CREATE INDEX IF NOT EXISTS "fleet_vehicles_vehicleNumber_idx" ON "fleet_vehicles"("vehicleNumber")`,
      `CREATE TABLE IF NOT EXISTS "vehicle_documents" ("id" TEXT NOT NULL, "vehicleId" TEXT, "driverId" TEXT, "truckId" TEXT, "trailerId" TEXT, "title" TEXT NOT NULL, "documentType" TEXT NOT NULL, "fileName" TEXT, "mimeType" TEXT, "fileSize" INTEGER, "fileData" BYTEA, "validFrom" TIMESTAMP(3), "validUntil" TIMESTAMP(3), "reminderStartDate" TIMESTAMP(3), "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id"), CONSTRAINT "vehicle_documents_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "fleet_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "vehicle_documents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "vehicle_documents_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "vehicle_documents_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      `ALTER TABLE "vehicle_documents" ALTER COLUMN "vehicleId" DROP NOT NULL`,
      `ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "driverId" TEXT`,
      `ALTER TABLE "vehicle_documents" ALTER COLUMN "fileName" DROP NOT NULL`,
      `ALTER TABLE "vehicle_documents" ALTER COLUMN "mimeType" DROP NOT NULL`,
      `ALTER TABLE "vehicle_documents" ALTER COLUMN "fileSize" DROP NOT NULL`,
      `ALTER TABLE "vehicle_documents" ALTER COLUMN "fileData" DROP NOT NULL`,
      `UPDATE "vehicle_documents" SET "reminderStartDate" = "validUntil" - INTERVAL '10 days' WHERE "documentType" IN ('Fire extinguisher', 'Operation card', 'Istimara', 'Insurance', 'Driver card', 'Fahas') AND "validUntil" IS NOT NULL AND "reminderStartDate" IS DISTINCT FROM "validUntil" - INTERVAL '10 days'`,
      `ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "truckId" TEXT`,
      `ALTER TABLE "vehicle_documents" ADD COLUMN IF NOT EXISTS "trailerId" TEXT`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_documents_driverId_fkey') THEN ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_documents_truckId_fkey') THEN ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_documents_trailerId_fkey') THEN ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$`,
      `CREATE INDEX IF NOT EXISTS "vehicle_documents_vehicleId_idx" ON "vehicle_documents"("vehicleId")`,
      `CREATE INDEX IF NOT EXISTS "vehicle_documents_validUntil_idx" ON "vehicle_documents"("validUntil")`,
      `CREATE INDEX IF NOT EXISTS "vehicle_documents_reminderStartDate_idx" ON "vehicle_documents"("reminderStartDate")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_documents_vehicleId_documentType_key" ON "vehicle_documents"("vehicleId", "documentType")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_documents_truckId_documentType_key" ON "vehicle_documents"("truckId", "documentType")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_documents_trailerId_documentType_key" ON "vehicle_documents"("trailerId", "documentType")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_documents_driverId_documentType_key" ON "vehicle_documents"("driverId", "documentType")`,
      `CREATE INDEX IF NOT EXISTS "vehicle_documents_truckId_idx" ON "vehicle_documents"("truckId")`,
      `CREATE INDEX IF NOT EXISTS "vehicle_documents_trailerId_idx" ON "vehicle_documents"("trailerId")`,
      `CREATE INDEX IF NOT EXISTS "vehicle_documents_driverId_idx" ON "vehicle_documents"("driverId")`,
      `INSERT INTO "drivers" ("id", "name", "normalizedName", "createdAt", "updatedAt") SELECT 'drv_' || md5(names.normalized), MIN(names.raw_name), names.normalized, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM (SELECT lower(regexp_replace(btrim("driverName"), '[[:space:]]+', ' ', 'g')) AS normalized, btrim("driverName") AS raw_name FROM "trucks" WHERE "driverName" IS NOT NULL AND btrim("driverName") <> '' AND lower(btrim("driverName")) NOT IN ('na', 'n/a', 'none', 'unknown', 'unassigned', '-') UNION ALL SELECT lower(regexp_replace(btrim("driverName"), '[[:space:]]+', ' ', 'g')) AS normalized, btrim("driverName") AS raw_name FROM "trailers" WHERE "driverName" IS NOT NULL AND btrim("driverName") <> '' AND lower(btrim("driverName")) NOT IN ('na', 'n/a', 'none', 'unknown', 'unassigned', '-')) AS names GROUP BY names.normalized ON CONFLICT ("normalizedName") DO NOTHING`,
      `WITH legacy_cards AS (SELECT vd."id" AS document_id, d."id" AS driver_id, row_number() OVER (PARTITION BY d."id" ORDER BY vd."updatedAt" DESC, vd."id") AS row_num FROM "vehicle_documents" vd JOIN "trucks" t ON t."id" = vd."truckId" JOIN "drivers" d ON d."normalizedName" = lower(regexp_replace(btrim(t."driverName"), '[[:space:]]+', ' ', 'g')) WHERE vd."documentType" = 'Driver card' AND vd."driverId" IS NULL AND t."driverName" IS NOT NULL AND btrim(t."driverName") <> '' AND lower(btrim(t."driverName")) NOT IN ('na', 'n/a', 'none', 'unknown', 'unassigned', '-') AND NOT EXISTS (SELECT 1 FROM "vehicle_documents" existing WHERE existing."driverId" = d."id" AND existing."documentType" = 'Driver card')) UPDATE "vehicle_documents" vd SET "driverId" = legacy_cards.driver_id, "truckId" = NULL FROM legacy_cards WHERE vd."id" = legacy_cards.document_id AND legacy_cards.row_num = 1`,
      `CREATE TABLE IF NOT EXISTS "maintenance_types" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "intervalDays" INTEGER, "intervalMileage" INTEGER, "reminderDaysBefore" INTEGER NOT NULL DEFAULT 14, "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "maintenance_types_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_types_name_key" ON "maintenance_types"("name")`,
      `CREATE TABLE IF NOT EXISTS "_MaintenanceTypeToVehicleType" ("A" TEXT NOT NULL, "B" TEXT NOT NULL, CONSTRAINT "_MaintenanceTypeToVehicleType_A_fkey" FOREIGN KEY ("A") REFERENCES "maintenance_types"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "_MaintenanceTypeToVehicleType_B_fkey" FOREIGN KEY ("B") REFERENCES "vehicle_types"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "_MaintenanceTypeToVehicleType_AB_unique" ON "_MaintenanceTypeToVehicleType"("A", "B")`,
      `CREATE INDEX IF NOT EXISTS "_MaintenanceTypeToVehicleType_B_index" ON "_MaintenanceTypeToVehicleType"("B")`
    ]
    for (const statement of statements) await client.$executeRawUnsafe(statement)
  })()
  fleetPlanningMigrations.set(client, migration)
  try { await migration } catch (error) { fleetPlanningMigrations.delete(client); throw error }
}

const databaseScope = new AsyncLocalStorage<DatabaseScope>()
const passkeySchemaMigrations = new WeakMap<PrismaClient, Promise<void>>()

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

/** Additive passkey schema setup for both the primary and tenant databases. */
export async function ensurePasskeySchema() {
  const client = await getRequestDatabaseClient()
  const existing = passkeySchemaMigrations.get(client)
  if (existing) return existing

  const migration = (async () => {
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "passkey_credentials" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "credentialId" TEXT NOT NULL,
        "publicKey" BYTEA NOT NULL,
        "counter" BIGINT NOT NULL DEFAULT 0,
        "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "deviceType" TEXT NOT NULL,
        "backedUp" BOOLEAN NOT NULL DEFAULT FALSE,
        "name" TEXT NOT NULL DEFAULT 'Passkey',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastUsedAt" TIMESTAMP(3),
        CONSTRAINT "passkey_credentials_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "passkey_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)
    await client.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credentials_credentialId_key" ON "passkey_credentials"("credentialId")`)
    await client.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "passkey_credentials_userId_idx" ON "passkey_credentials"("userId")`)
  })()

  passkeySchemaMigrations.set(client, migration)
  try {
    await migration
  } catch (error) {
    passkeySchemaMigrations.delete(client)
    throw error
  }
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
          if (client !== controlDb && fleetPlanningModels.has(property)) return ensureFleetPlanningSchema(client).then(() => (client as any)[property][method](...args))
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
