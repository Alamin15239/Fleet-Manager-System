const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function prepareOrganizationDatabaseIndex() {
  const indexReady = await prisma.$transaction(async (transaction) => {
    const tableResult = await transaction.$queryRawUnsafe(
      `SELECT to_regclass('public.organizations') IS NOT NULL AS "exists"`
    )

    if (!tableResult[0]?.exists) return false

    // These nullable tenant-provider fields are safe to add before Prisma's
    // schema push. Existing organizations stay on Neon unless explicitly
    // assigned a Prisma tenant database by the provisioning flow.
    await transaction.$executeRawUnsafe(
      `ALTER TABLE "public"."organizations"
       ADD COLUMN IF NOT EXISTS "databaseProvider" TEXT NOT NULL DEFAULT 'NEON'`
    )
    await transaction.$executeRawUnsafe(
      `ALTER TABLE "public"."organizations"
       ADD COLUMN IF NOT EXISTS "prismaDatabaseId" TEXT`
    )

    const duplicateResult = await transaction.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS "groups" FROM (
         SELECT 1
         FROM "public"."organizations"
         WHERE "prismaDatabaseId" IS NOT NULL
         GROUP BY "prismaDatabaseId"
         HAVING COUNT(*) > 1
       ) AS duplicate_prisma_database_ids`
    )

    if (duplicateResult[0]?.groups > 0) {
      throw new Error(
        `Found ${duplicateResult[0].groups} duplicate Prisma database ID group(s). No organization rows were changed; resolve the duplicates before deploying.`
      )
    }

    // Create the exact nullable unique index Prisma expects. PostgreSQL permits
    // multiple NULL values, so existing organizations do not conflict.
    await transaction.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "organizations_prismaDatabaseId_key"
       ON "public"."organizations" ("prismaDatabaseId")`
    )
    return true
  })

  console.log(indexReady
    ? 'Organization database ID uniqueness preflight passed.'
    : 'Organizations table is not present yet; Prisma will create it.')
}

prepareOrganizationDatabaseIndex()
  .catch((error) => {
    console.error(`Organization database ID preflight failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
