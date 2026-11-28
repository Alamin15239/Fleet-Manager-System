import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { controlDb, db, getOrganizationPrismaClient, getPrimaryOrganization, withOrganization, type OrganizationRecord } from '@/lib/db'
import { deleteOrganizationObject, getOrganizationObject, putOrganizationObject } from '@/lib/object-storage'

export const runtime = 'nodejs'
export const maxDuration = 300

type Counters = { scanned: number; planned: number; migrated: number; skipped: number; failed: number }
type Failure = { organization: string; type: string; id: string; reason: string }
const MAX_FILE_BYTES = 25 * 1024 * 1024

function digest(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function dataUri(value: string) {
  const parsed = fileDataUri(value)
  if (!parsed || !parsed.contentType.startsWith('image/')) return null
  return parsed
}

function fileDataUri(value: string) {
  const match = value.match(/^data:(image\/(?:jpeg|png|gif|webp)|application\/(?:pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet));base64,([A-Za-z0-9+/]+={0,2})$/i)
  if (!match) return null
  const body = Buffer.from(match[2], 'base64')
  if (!body.length || body.length > MAX_FILE_BYTES) throw new Error('Embedded document is empty or exceeds the 25 MB migration limit')
  const contentType = match[1].toLowerCase()
  const starts = (bytes: number[]) => body.length >= bytes.length && body.subarray(0, bytes.length).equals(Buffer.from(bytes))
  const valid = contentType === 'image/jpeg' ? starts([0xff, 0xd8, 0xff])
    : contentType === 'image/png' ? starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : contentType === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(body.subarray(0, 6).toString('ascii'))
    : contentType === 'image/webp' ? body.length >= 12 && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP'
    : contentType === 'application/pdf' ? body.subarray(0, 5).toString('ascii') === '%PDF-'
    : ['application/msword', 'application/vnd.ms-excel'].includes(contentType) ? starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    : starts([0x50, 0x4b, 0x03, 0x04])
  if (!valid) throw new Error('Embedded document content does not match its declared format')
  return { contentType, body }
}

function extensionFor(contentType: string, fallback: string) {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'application/pdf': 'pdf', 'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  }
  return extensions[contentType] || fallback.split('.').pop()?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
}

async function storeAndVerify(input: {
  organizationId: string
  module: string
  entityId: string
  fileName: string
  contentType: string
  body: Buffer
}) {
  const stored = await putOrganizationObject(input)
  try {
    const copy = await getOrganizationObject(stored.key)
    if (copy.body.byteLength !== input.body.byteLength || digest(copy.body) !== digest(input.body)) {
      throw new Error('Uploaded object failed SHA-256 verification')
    }
    return stored.key
  } catch (error) {
    await deleteOrganizationObject(stored.key).catch(() => undefined)
    throw error
  }
}

async function migrateDatabase(organization: OrganizationRecord, execute: boolean) {
  const client = organization.isPrimary ? controlDb : await getOrganizationPrismaClient(organization)
  if (!organization.isPrimary) {
    await withOrganization(organization, () => db.vehicleDocument.findMany({ select: { id: true }, take: 0 }).then(() => undefined))
  }
  const counters: Counters = { scanned: 0, planned: 0, migrated: 0, skipped: 0, failed: 0 }
  const failures: Failure[] = []
  const orgId = organization.id || organization.slug
  const recordFailure = (type: string, id: string, error: unknown) => {
    counters.failed++
    failures.push({
      organization: organization.slug,
      type,
      id,
      reason: error instanceof Error ? error.message.slice(0, 180) : 'Unknown migration error',
    })
  }

  const profiles = await client.user.findMany({
    where: { profileImage: { startsWith: 'data:image/' } },
    select: { id: true, profileImage: true },
    take: 500,
    orderBy: { id: 'asc' },
  })
  for (const row of profiles) {
    counters.scanned++
    try {
      const parsed = dataUri(row.profileImage || '')
      if (!parsed) { counters.skipped++; continue }
      if (!execute) { counters.planned++; continue }
      const key = await storeAndVerify({
        organizationId: orgId, module: 'profile-images', entityId: row.id,
        fileName: 'profile.' + extensionFor(parsed.contentType, 'jpg'),
        contentType: parsed.contentType, body: parsed.body,
      })
      const updated = await client.user.updateMany({
        where: { id: row.id, profileImage: row.profileImage },
        data: { profileImage: 's3://' + key },
      })
      if (!updated.count) {
        await deleteOrganizationObject(key).catch(() => undefined)
        counters.skipped++
      } else counters.migrated++
    } catch (error) { recordFailure('profileImage', row.id, error) }
  }

  const trucks = await client.truck.findMany({
    where: { image: { startsWith: 'data:image/' }, isDeleted: false },
    select: { id: true, image: true },
    take: 500,
    orderBy: { id: 'asc' },
  })
  for (const row of trucks) {
    counters.scanned++
    try {
      const parsed = dataUri(row.image || '')
      if (!parsed) { counters.skipped++; continue }
      if (!execute) { counters.skipped++; continue }
      const key = await storeAndVerify({
        organizationId: orgId, module: 'truck-images', entityId: row.id,
        fileName: 'truck.' + extensionFor(parsed.contentType, 'jpg'),
        contentType: parsed.contentType, body: parsed.body,
      })
      const updated = await client.truck.updateMany({
        where: { id: row.id, image: row.image },
        data: { image: 's3://' + key },
      })
      if (!updated.count) {
        await deleteOrganizationObject(key).catch(() => undefined)
        counters.skipped++
      } else counters.migrated++
    } catch (error) { recordFailure('truck.image', row.id, error) }
  }

  const vehicleDocuments = await client.$queryRaw<Array<{ id: string; fileName: string | null; mimeType: string | null; fileData: Uint8Array }>>`
    SELECT "id", "fileName", "mimeType", "fileData"
    FROM "vehicle_documents"
    WHERE "fileData" IS NOT NULL
      AND left(encode("fileData", 'escape'), 5) <> 's3://'
    ORDER BY "id"
    LIMIT 1000
  `
  for (const row of vehicleDocuments) {
    const oldBytes = row.fileData ? Buffer.from(row.fileData) : Buffer.alloc(0)
    if (!oldBytes.length) continue
    const pointer = oldBytes.toString('utf8')
    if (pointer.startsWith('s3://')) { counters.skipped++; continue }
    counters.scanned++
    try {
      if (oldBytes.length > MAX_FILE_BYTES) throw new Error('File exceeds the 25 MB migration limit')
      const contentType = row.mimeType || 'application/octet-stream'
      if (!execute) { counters.skipped++; continue }
      const key = await storeAndVerify({
        organizationId: orgId, module: 'vehicle-documents', entityId: row.id,
        fileName: row.fileName || 'vehicle-document.' + extensionFor(contentType, 'bin'),
        contentType, body: oldBytes,
      })
      const updated = await client.$executeRaw`
        UPDATE "vehicle_documents"
        SET "fileData" = ${Buffer.from('s3://' + key)}
        WHERE "id" = ${row.id} AND "fileData" = ${oldBytes}
      `
      if (!updated) {
        await deleteOrganizationObject(key).catch(() => undefined)
        counters.skipped++
      } else counters.migrated++
    } catch (error) { recordFailure('vehicleDocument.fileData', row.id, error) }
  }

  const documents = await client.document.findMany({
    where: { fileUrl: { startsWith: 'data:' }, type: { in: ['truck', 'maintenance'] } },
    select: { id: true, title: true, type: true, fileUrl: true, editorState: true },
    take: 500,
    orderBy: { id: 'asc' },
  })
  for (const row of documents) {
    counters.scanned++
    try {
      const parsed = fileDataUri(row.fileUrl || '')
      if (!parsed) { counters.skipped++; continue }
      const metadata = row.editorState && typeof row.editorState === 'object'
        ? row.editorState as Record<string, any>
        : {}
      const oldStorage = metadata.storage && typeof metadata.storage === 'object'
        ? metadata.storage as Record<string, unknown>
        : {}
      const entityId = typeof oldStorage.entityId === 'string' ? oldStorage.entityId : ''
      if (!entityId) { counters.skipped++; continue }
      if (!execute) { counters.skipped++; continue }
      const module = row.type === 'truck' ? 'truck-documents' : 'maintenance-documents'
      const extension = extensionFor(parsed.contentType, 'bin')
      const fileName = /\.[a-z0-9]{1,10}$/i.test(row.title) ? row.title : 'uploaded-document.' + extension
      const key = await storeAndVerify({
        organizationId: orgId, module, entityId,
        fileName, contentType: parsed.contentType, body: parsed.body,
      })
      const updated = await client.document.updateMany({
        where: { id: row.id, fileUrl: row.fileUrl },
        data: {
          fileUrl: 's3://' + key,
          editorState: {
            ...metadata,
            storage: { organizationId: orgId, module, entityId },
          },
        },
      })
      if (!updated.count) {
        await deleteOrganizationObject(key).catch(() => undefined)
        counters.skipped++
      } else counters.migrated++
    } catch (error) { recordFailure('document.fileUrl', row.id, error) }
  }

  const remaining = {
    profileImages: await client.user.count({ where: { profileImage: { startsWith: 'data:image/' } } }),
    truckImages: await client.truck.count({ where: { image: { startsWith: 'data:image/' }, isDeleted: false } }),
    vehicleDocuments: Number((await client.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM "vehicle_documents"
      WHERE "fileData" IS NOT NULL AND left(encode("fileData", 'escape'), 5) <> 's3://'
    `)[0]?.count || 0),
    documentFiles: await client.document.count({ where: { fileUrl: { startsWith: 'data:' } } }),
  }
  return { organization: organization.slug, counters, failures, remaining }
}

export async function POST(request: NextRequest) {
  try {
    const administrator = await requireAdmin(request)
    if (!administrator.isPrimaryOrganization) {
      throw new Error('Primary organization administrator access required')
    }
    const body = await request.json().catch(() => ({}))
    const execute = body?.execute === true
    const primary = await getPrimaryOrganization()
    const organizations = await controlDb.organization.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true, name: true, slug: true, status: true, isPrimary: true,
        encryptedDatabaseUrl: true, oneDriveAccountId: true, oneDriveAccountEmailHash: true,
      },
      orderBy: { createdAt: 'asc' },
    }) as OrganizationRecord[]
    if (!organizations.some(item => item.id === primary.id)) organizations.unshift(primary)

    const results = []
    for (const organization of organizations) {
      try {
        results.push(await migrateDatabase(organization, execute))
      } catch (error) {
        results.push({
          organization: organization.slug,
          counters: { scanned: 0, planned: 0, migrated: 0, skipped: 0, failed: 1 },
          failures: [{
            organization: organization.slug, type: 'organization-database', id: organization.id,
            reason: error instanceof Error ? error.message.slice(0, 180) : 'Database unavailable',
          }],
        })
      }
    }
    const totals = results.reduce((sum, result) => ({
      scanned: sum.scanned + result.counters.scanned,
      planned: sum.planned + result.counters.planned,
      migrated: sum.migrated + result.counters.migrated,
      skipped: sum.skipped + result.counters.skipped,
      failed: sum.failed + result.counters.failed,
    }), { scanned: 0, planned: 0, migrated: 0, skipped: 0, failed: 0 })

    return NextResponse.json({
      success: totals.failed === 0,
      mode: execute ? 'migrate' : 'scan',
      note: 'This batch migrates embedded profile images, embedded truck images, legacy vehicle-document bytes, and validated embedded Document.fileUrl files. External links and JSON attachment/signature fields are not changed.',
      totals,
      organizations: results,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const unauthorized = ['No token provided', 'Invalid token'].includes(message)
    const forbidden = message === 'Insufficient permissions' || message === 'Primary organization administrator access required'
    return NextResponse.json({
      error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Storage migration scan failed',
    }, { status: unauthorized ? 401 : forbidden ? 403 : 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
