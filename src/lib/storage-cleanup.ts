import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { deleteOrganizationObject, isOrganizationObjectKey } from '@/lib/object-storage'

type CleanupRow = { id: string; objectKey: string; attempts: number }

let schemaReady = false
let schemaPromise: Promise<void> | null = null

async function ensureStorageCleanupSchema() {
  if (schemaReady) return
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "storage_object_deletion_queue" (
        "id" TEXT NOT NULL,
        "objectKey" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lockedAt" TIMESTAMP(3),
        "lastError" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "storage_object_deletion_queue_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "storage_object_deletion_queue_objectKey_key" UNIQUE ("objectKey")
      )`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "storage_object_deletion_queue_status_availableAt_idx" ON "storage_object_deletion_queue" ("status", "availableAt")`)
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "storage_object_deletion_queue_lockedAt_idx" ON "storage_object_deletion_queue" ("lockedAt")`)
      schemaReady = true
    })()
  }
  try { await schemaPromise } catch (error) { schemaPromise = null; throw error }
}

/**
 * Atomically removes the vehicle-document row and records its private object
 * for asynchronous deletion. The queue lives in the same tenant database.
 */
export async function deleteVehicleDocumentWithCleanup(input: {
  documentId: string
  objectKey: string | null
  organizationId: string
}) {
  if (input.objectKey && !isOrganizationObjectKey(input.objectKey, input.organizationId)) {
    throw new Error('Document not found')
  }
  await ensureStorageCleanupSchema()
  return db.$transaction(async (transaction) => {
    const deleted = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
      'DELETE FROM "vehicle_documents" WHERE "id" = $1 RETURNING "id"',
      input.documentId,
    )
    if (!deleted.length) return { deleted: false, queued: false }
    if (input.objectKey) {
      await transaction.$executeRawUnsafe(
        `INSERT INTO "storage_object_deletion_queue" ("id", "objectKey") VALUES ($1, $2) ON CONFLICT ("objectKey") DO NOTHING`,
        randomUUID(),
        input.objectKey,
      )
    }
    return { deleted: true, queued: !!input.objectKey }
  })
}

/** Process a bounded batch; stale locks are reclaimed after a crashed invocation. */
export async function processPendingStorageObjectDeletions(limit = 20) {
  await ensureStorageCleanupSchema()
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)))
  const claimed = await db.$transaction(async (transaction) =>
    transaction.$queryRawUnsafe<CleanupRow[]>(
      `WITH candidates AS (
        SELECT "id"
        FROM "storage_object_deletion_queue"
        WHERE ("status" = 'PENDING' AND "availableAt" <= NOW())
           OR ("status" = 'PROCESSING' AND "lockedAt" < NOW() - INTERVAL '10 minutes')
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )
      UPDATE "storage_object_deletion_queue" AS queue
      SET "status" = 'PROCESSING',
          "attempts" = queue."attempts" + 1,
          "lockedAt" = NOW(),
          "updatedAt" = NOW()
      FROM candidates
      WHERE queue."id" = candidates."id"
      RETURNING queue."id", queue."objectKey", queue."attempts"`,
      safeLimit,
    ),
  )

  let deleted = 0
  let retried = 0
  for (const item of claimed) {
    try {
      if (!item.objectKey.startsWith('organizations/')) throw new Error('Invalid queued object key')
      await deleteOrganizationObject(item.objectKey)
      await db.$executeRawUnsafe('DELETE FROM "storage_object_deletion_queue" WHERE "id" = $1', item.id)
      deleted++
    } catch (error) {
      const delayMinutes = Math.min(1440, [1, 5, 15, 60, 360, 1440][Math.min(item.attempts - 1, 5)])
      const message = (error instanceof Error ? error.message : 'Object deletion failed').slice(0, 1000)
      await db.$executeRawUnsafe(
        `UPDATE "storage_object_deletion_queue"
         SET "status" = 'PENDING',
             "availableAt" = NOW() + ($2 * INTERVAL '1 minute'),
             "lockedAt" = NULL,
             "lastError" = $3,
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        item.id,
        delayMinutes,
        message,
      )
      retried++
      console.error('Private object deletion queued for retry:', { attempts: item.attempts, error: message })
    }
  }
  return { claimed: claimed.length, deleted, retried }
}
