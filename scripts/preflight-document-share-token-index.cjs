const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function prepareDocumentShareTokenIndex() {
  const indexReady = await prisma.$transaction(async (transaction) => {
    const tableResult = await transaction.$queryRawUnsafe(
      "SELECT to_regclass('public.vehicle_documents') IS NOT NULL AS \"exists\""
    )

    if (!tableResult[0]?.exists) return false

    // Add the nullable token column before Prisma schema push. Existing document
    // records receive NULL, which is allowed multiple times by PostgreSQL unique indexes.
    await transaction.$executeRawUnsafe(
      'ALTER TABLE "public"."vehicle_documents" ADD COLUMN IF NOT EXISTS "shareToken" TEXT'
    )

    const duplicateResult = await transaction.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS "groups" FROM (' +
      ' SELECT "shareToken" FROM "public"."vehicle_documents"' +
      ' WHERE "shareToken" IS NOT NULL GROUP BY "shareToken" HAVING COUNT(*) > 1' +
      ') AS duplicate_document_share_tokens'
    )

    if (duplicateResult[0]?.groups > 0) {
      throw new Error(
        'Found ' + duplicateResult[0].groups +
        ' duplicate document share-token value(s). No document rows were deleted or modified; resolve the duplicate tokens before deploying.'
      )
    }

    // Create the exact nullable unique index Prisma expects. Multiple NULL values
    // remain valid, while every issued public token must be unique.
    await transaction.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_documents_shareToken_key" ' +
      'ON "public"."vehicle_documents" ("shareToken")'
    )
    return true
  })

  console.log(indexReady
    ? 'Document share-token uniqueness preflight passed.'
    : 'Vehicle documents table is not present yet; Prisma will create it.')
}

prepareDocumentShareTokenIndex()
  .catch((error) => {
    console.error('Document share-token preflight failed: ' + error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
