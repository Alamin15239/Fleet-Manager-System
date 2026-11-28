import { createHash } from 'node:crypto'
import { deleteOrganizationObject, getOrganizationObject, putOrganizationObject } from '@/lib/object-storage'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const DATA_URI = /^data:(image\/(?:jpeg|png|gif|webp)|application\/(?:pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet));base64,([A-Za-z0-9+/]+={0,2})$/i

export type StorageMigrationResult = {
  scanned: number
  planned: number
  migrated: number
  skipped: number
  failed: number
  failures: Array<{ type: string; id: string; reason: string }>
  remaining: Record<string, number>
}

function parseDataUri(value: unknown) {
  if (typeof value !== 'string') return null
  const match = value.match(DATA_URI)
  if (!match) return null
  const body = Buffer.from(match[2], 'base64')
  if (!body.length || body.byteLength > MAX_FILE_BYTES) throw new Error('Embedded file is empty or exceeds the 25 MB migration limit')
  const starts = (bytes: number[]) => body.length >= bytes.length && body.subarray(0, bytes.length).equals(Buffer.from(bytes))
  const valid = match[1].toLowerCase() === 'image/jpeg' ? starts([0xff, 0xd8, 0xff])
    : match[1].toLowerCase() === 'image/png' ? starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : match[1].toLowerCase() === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(body.subarray(0, 6).toString('ascii'))
        : match[1].toLowerCase() === 'image/webp' ? body.length >= 12 && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP'
          : match[1].toLowerCase() === 'application/pdf' ? body.subarray(0, 5).toString('ascii') === '%PDF-'
            : match[1].toLowerCase().startsWith('application/vnd.openxmlformats') ? starts([0x50, 0x4b, 0x03, 0x04])
              : starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  if (!valid) throw new Error('Embedded file content does not match its declared type')
  return { contentType: match[1].toLowerCase(), body }
}

function extensionFor(contentType: string, fallback = 'bin') {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'application/pdf': 'pdf', 'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  }
  return extensions[contentType] || fallback.split('.').pop()?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
}

async function storeAndVerify(input: { organizationId: string; module: string; entityId: string; fileName: string; contentType: string; body: Buffer }) {
  const stored = await putOrganizationObject(input)
  try {
    const copy = await getOrganizationObject(stored.key)
    const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex')
    if (hash(copy.body) !== hash(input.body)) throw new Error('Bucket verification failed')
    return stored.key
  } catch (error) {
    await deleteOrganizationObject(stored.key).catch(() => undefined)
    throw error
  }
}

async function migrateJson(client: any, table: string, column: string, id: string, value: unknown, organizationId: string, module: string, execute: boolean, result: StorageMigrationResult) {
  const visit = async (current: unknown, path: string): Promise<unknown> => {
    const parsed = parseDataUri(current)
    if (parsed) {
      result.scanned++
      if (!execute) { result.planned++; return current }
      const key = await storeAndVerify({ organizationId, module, entityId: id, fileName: `${path.replace(/[^a-z0-9_-]/gi, '_') || 'attachment'}.${extensionFor(parsed.contentType)}`, contentType: parsed.contentType, body: parsed.body })
      result.migrated++
      return `s3://${key}`
    }
    if (Array.isArray(current)) return Promise.all(current.map((item, index) => visit(item, `${path}.${index}`)))
    if (current && typeof current === 'object') {
      const output: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(current as Record<string, unknown>)) output[key] = await visit(child, path ? `${path}.${key}` : key)
      return output
    }
    return current
  }
  const migrated = await visit(value, '')
  if (execute && JSON.stringify(migrated) !== JSON.stringify(value)) {
    if (table === 'workshop_job_cards' && column === 'items') await client.$executeRaw`UPDATE "workshop_job_cards" SET "items" = ${JSON.stringify(migrated)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${id} AND "items" IS NOT DISTINCT FROM ${JSON.stringify(value)}::jsonb`
    if (table === 'workshop_job_cards' && column === 'checklist') await client.$executeRaw`UPDATE "workshop_job_cards" SET "checklist" = ${JSON.stringify(migrated)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${id} AND "checklist" IS NOT DISTINCT FROM ${JSON.stringify(value)}::jsonb`
    if (table === 'maintenance_records' && column === 'attachments') await client.$executeRaw`UPDATE "maintenance_records" SET "attachments" = ${JSON.stringify(migrated)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${id} AND "attachments" IS NOT DISTINCT FROM ${JSON.stringify(value)}::jsonb`
    if (table === 'trailer_maintenance_records' && column === 'attachments') await client.$executeRaw`UPDATE "trailer_maintenance_records" SET "attachments" = ${JSON.stringify(migrated)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${id} AND "attachments" IS NOT DISTINCT FROM ${JSON.stringify(value)}::jsonb`
  }
}

export async function migrateOrganizationStorage(client: any, organizationId: string, execute: boolean): Promise<StorageMigrationResult> {
  const result: StorageMigrationResult = { scanned: 0, planned: 0, migrated: 0, skipped: 0, failed: 0, failures: [], remaining: {} }
  const fail = (type: string, id: string, error: unknown) => { result.failed++; result.failures.push({ type, id, reason: error instanceof Error ? error.message.slice(0, 200) : 'Migration failed' }) }

  const profiles = await client.$queryRaw`SELECT "id", "profileImage" FROM "users" WHERE "profileImage" LIKE ${'data:image%'}` as Array<{ id: string; profileImage: string | null }>
  for (const row of profiles) {
    try {
      const parsed = parseDataUri(row.profileImage)
      if (!parsed) { result.skipped++; continue }
      result.scanned++
      if (!execute) { result.planned++; continue }
      const key = await storeAndVerify({ organizationId, module: 'profile-images', entityId: row.id, fileName: `profile.${extensionFor(parsed.contentType, 'jpg')}`, contentType: parsed.contentType, body: parsed.body })
      const updated = await client.$executeRaw`UPDATE "users" SET "profileImage" = ${`s3://${key}`} WHERE "id" = ${row.id} AND "profileImage" = ${row.profileImage}`
      if (!updated) await deleteOrganizationObject(key).catch(() => undefined); else result.migrated++
    } catch (error) { fail('profileImage', row.id, error) }
  }

  const trucks = await client.$queryRaw`SELECT "id", "image" FROM "trucks" WHERE "image" LIKE ${'data:image%'} AND "isDeleted" = FALSE` as Array<{ id: string; image: string | null }>
  for (const row of trucks) {
    try {
      const parsed = parseDataUri(row.image)
      if (!parsed) { result.skipped++; continue }
      result.scanned++
      if (!execute) { result.planned++; continue }
      const key = await storeAndVerify({ organizationId, module: 'truck-images', entityId: row.id, fileName: `truck.${extensionFor(parsed.contentType, 'jpg')}`, contentType: parsed.contentType, body: parsed.body })
      const updated = await client.$executeRaw`UPDATE "trucks" SET "image" = ${`s3://${key}`} WHERE "id" = ${row.id} AND "image" = ${row.image}`
      if (!updated) await deleteOrganizationObject(key).catch(() => undefined); else result.migrated++
    } catch (error) { fail('truck.image', row.id, error) }
  }

  const vehicleDocuments = await client.$queryRaw`SELECT "id", "fileName", "mimeType", "fileData" FROM "vehicle_documents" WHERE "fileData" IS NOT NULL ORDER BY "id"` as Array<{ id: string; fileName: string | null; mimeType: string | null; fileData: Uint8Array }>
  for (const row of vehicleDocuments) {
    const oldBytes = Buffer.from(row.fileData || [])
    if (!oldBytes.length || oldBytes.toString('utf8').startsWith('s3://')) { result.skipped++; continue }
    result.scanned++
    try {
      if (oldBytes.byteLength > MAX_FILE_BYTES) throw new Error('Vehicle document exceeds the 25 MB migration limit')
      if (!execute) { result.planned++; continue }
      const key = await storeAndVerify({ organizationId, module: 'vehicle-documents', entityId: row.id, fileName: row.fileName || `vehicle-document.${extensionFor(row.mimeType || '')}`, contentType: row.mimeType || 'application/octet-stream', body: oldBytes })
      const updated = await client.$executeRaw`UPDATE "vehicle_documents" SET "fileData" = ${Buffer.from(`s3://${key}`)} WHERE "id" = ${row.id} AND "fileData" = ${oldBytes}`
      if (!updated) await deleteOrganizationObject(key).catch(() => undefined); else result.migrated++
    } catch (error) { fail('vehicleDocument.fileData', row.id, error) }
  }

  const documents = await client.$queryRaw`SELECT "id", "title", "type", "fileUrl", "editorState" FROM "documents" WHERE "fileUrl" LIKE ${'data:%'}` as Array<{ id: string; title: string; type: string; fileUrl: string | null; editorState: unknown }>
  for (const row of documents) {
    try {
      const parsed = parseDataUri(row.fileUrl)
      const metadata = row.editorState && typeof row.editorState === 'object' ? row.editorState as Record<string, any> : {}
      const storage = metadata.storage && typeof metadata.storage === 'object' ? metadata.storage : {}
      const entityId = typeof storage.entityId === 'string' ? storage.entityId : row.id
      if (!parsed) { result.skipped++; continue }
      result.scanned++
      if (!execute) { result.planned++; continue }
      const module = row.type === 'truck' ? 'truck-documents' : row.type === 'purchase-invoice' ? 'purchase-invoice-documents' : 'maintenance-documents'
      const fileName = row.title || `document.${extensionFor(parsed.contentType)}`
      const key = await storeAndVerify({ organizationId, module, entityId, fileName, contentType: parsed.contentType, body: parsed.body })
      const updated = await client.$executeRaw`UPDATE "documents" SET "fileUrl" = ${`s3://${key}`}, "editorState" = ${JSON.stringify({ ...metadata, storage: { organizationId, module, entityId, fileName, contentType: parsed.contentType, size: parsed.body.byteLength } })}::jsonb, "updatedAt" = NOW() WHERE "id" = ${row.id} AND "fileUrl" = ${row.fileUrl}`
      if (!updated) await deleteOrganizationObject(key).catch(() => undefined); else result.migrated++
    } catch (error) { fail('document.fileUrl', row.id, error) }
  }

  const jsonSources = [
    ['workshop_job_cards', 'items', 'job-card-attachments'], ['workshop_job_cards', 'checklist', 'job-card-attachments'],
    ['maintenance_records', 'attachments', 'maintenance-attachments'], ['trailer_maintenance_records', 'attachments', 'trailer-maintenance-attachments'],
  ] as const
  for (const [table, column, module] of jsonSources) {
    try {
      const rows = table === 'workshop_job_cards' && column === 'items'
        ? await client.$queryRaw`SELECT "id", "items" AS "value" FROM "workshop_job_cards" WHERE "items"::text LIKE ${'%data:%'}` as Array<{ id: string; value: unknown }>
        : table === 'workshop_job_cards' && column === 'checklist'
          ? await client.$queryRaw`SELECT "id", "checklist" AS "value" FROM "workshop_job_cards" WHERE "checklist"::text LIKE ${'%data:%'}` as Array<{ id: string; value: unknown }>
          : table === 'maintenance_records'
            ? await client.$queryRaw`SELECT "id", "attachments" AS "value" FROM "maintenance_records" WHERE "attachments"::text LIKE ${'%data:%'}` as Array<{ id: string; value: unknown }>
            : await client.$queryRaw`SELECT "id", "attachments" AS "value" FROM "trailer_maintenance_records" WHERE "attachments"::text LIKE ${'%data:%'}` as Array<{ id: string; value: unknown }>
      for (const row of rows) await migrateJson(client, table, column, row.id, row.value, organizationId, module, execute, result)
    } catch (error) { fail(`${table}.${column}`, '*', error) }
  }

  const signatureRows = await client.$queryRaw`SELECT "id", 'technicianSignature' AS field, "technicianSignature" AS value FROM "workshop_job_cards" WHERE "technicianSignature" LIKE ${'data:%'} UNION ALL SELECT "id", 'supervisorSignature', "supervisorSignature" FROM "workshop_job_cards" WHERE "supervisorSignature" LIKE ${'data:%'} UNION ALL SELECT "id", 'driverSignature', "driverSignature" FROM "workshop_job_cards" WHERE "driverSignature" LIKE ${'data:%'}` as Array<{ id: string; field: string; value: string }>
  for (const row of signatureRows) {
    try {
      const parsed = parseDataUri(row.value)
      if (!parsed) { result.skipped++; continue }
      result.scanned++
      if (!execute) { result.planned++; continue }
      const key = await storeAndVerify({ organizationId, module: 'job-card-signatures', entityId: row.id, fileName: `${row.field}.${extensionFor(parsed.contentType)}`, contentType: parsed.contentType, body: parsed.body })
      if (row.field === 'technicianSignature') await client.$executeRaw`UPDATE "workshop_job_cards" SET "technicianSignature" = ${`s3://${key}`} WHERE "id" = ${row.id} AND "technicianSignature" = ${row.value}`
      if (row.field === 'supervisorSignature') await client.$executeRaw`UPDATE "workshop_job_cards" SET "supervisorSignature" = ${`s3://${key}`} WHERE "id" = ${row.id} AND "supervisorSignature" = ${row.value}`
      if (row.field === 'driverSignature') await client.$executeRaw`UPDATE "workshop_job_cards" SET "driverSignature" = ${`s3://${key}`} WHERE "id" = ${row.id} AND "driverSignature" = ${row.value}`
      const updated = 1
      if (!updated) await deleteOrganizationObject(key).catch(() => undefined); else result.migrated++
    } catch (error) { fail(`workshopJobCard.${row.field}`, row.id, error) }
  }

  try {
    const tireEvidence = await client.$queryRaw`SELECT "id", "tireId", "evidenceUrl" FROM "tire_lifecycle_events" WHERE "evidenceUrl" LIKE ${'data:%'}` as Array<{ id: string; tireId: string; evidenceUrl: string }>
    for (const row of tireEvidence) {
      try {
        const parsed = parseDataUri(row.evidenceUrl)
        if (!parsed) { result.skipped++; continue }
        result.scanned++
        if (!execute) { result.planned++; continue }
        const key = await storeAndVerify({ organizationId, module: 'tire-evidence', entityId: row.tireId, fileName: `evidence-${row.id}.${extensionFor(parsed.contentType)}`, contentType: parsed.contentType, body: parsed.body })
        const updated = await client.$executeRaw`UPDATE "tire_lifecycle_events" SET "evidenceUrl" = ${`s3://${key}`} WHERE "id" = ${row.id} AND "evidenceUrl" = ${row.evidenceUrl}`
        if (!updated) await deleteOrganizationObject(key).catch(() => undefined); else result.migrated++
      } catch (error) { fail('tireLifecycleEvent.evidenceUrl', row.id, error) }
    }
  } catch (error) {
    if (!(error instanceof Error && /does not exist|relation .* not found/i.test(error.message))) fail('tireLifecycleEvent.evidenceUrl', '*', error)
  }

  result.remaining = {
    profileImages: Number(((await client.$queryRaw`SELECT COUNT(*) AS count FROM "users" WHERE "profileImage" LIKE ${'data:image%'}`) as Array<{ count: bigint }>)[0]?.count || 0),
    truckImages: Number(((await client.$queryRaw`SELECT COUNT(*) AS count FROM "trucks" WHERE "image" LIKE ${'data:image%'}`) as Array<{ count: bigint }>)[0]?.count || 0),
    vehicleDocuments: Number(((await client.$queryRaw`SELECT COUNT(*) AS count FROM "vehicle_documents" WHERE "fileData" IS NOT NULL AND left(encode("fileData", 'escape'), 5) <> 's3://'`) as Array<{ count: bigint }>)[0]?.count || 0),
    documentFiles: Number(((await client.$queryRaw`SELECT COUNT(*) AS count FROM "documents" WHERE "fileUrl" LIKE ${'data:%'}`) as Array<{ count: bigint }>)[0]?.count || 0),
    tireEvidence: Number((((await client.$queryRaw`SELECT COUNT(*) AS count FROM "tire_lifecycle_events" WHERE "evidenceUrl" LIKE ${'data:%'}`).catch(() => [{ count: 0 }])) as Array<{ count: bigint | number }>)[0]?.count || 0)),
  }
  return result
}
