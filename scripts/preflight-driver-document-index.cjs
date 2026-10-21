const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function prepareDriverDocumentIndex() {
  const indexReady = await prisma.$transaction(async (transaction) => {
    const tableResult = await transaction.$queryRawUnsafe(
      `SELECT to_regclass('public.vehicle_documents') IS NOT NULL AS "exists"`
    )

    if (!tableResult[0]?.exists) return false

    // Adding this nullable column is safe. Check existing values before adding
    // the unique index, so the deploy never drops or rewrites document rows.
    await transaction.$executeRawUnsafe(
      `ALTER TABLE "public"."vehicle_documents" ADD COLUMN IF NOT EXISTS "driverId" TEXT`
    )

    const duplicateResult = await transaction.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS "groups" FROM (
         SELECT 1
         FROM "public"."vehicle_documents"
         WHERE "driverId" IS NOT NULL
         GROUP BY "driverId", "documentType"
         HAVING COUNT(*) > 1
       ) AS duplicate_driver_documents`
    )

    if (duplicateResult[0]?.groups > 0) {
      throw new Error(
        `Found ${duplicateResult[0].groups} duplicate Driver Card owner/type group(s). No document rows were changed; resolve the duplicates before deploying.`
      )
    }

    await transaction.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_documents_driverId_documentType_key"
       ON "public"."vehicle_documents" ("driverId", "documentType")`
    )
    return true
  })

  console.log(indexReady
    ? 'Driver document uniqueness preflight passed.'
    : 'Vehicle documents table is not present yet; Prisma will create it.')
}

prepareDriverDocumentIndex()
  .catch((error) => {
    console.error(`Driver document schema preflight failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
