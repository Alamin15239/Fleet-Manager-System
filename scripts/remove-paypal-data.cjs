const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function removePayPalData() {
  await prisma.$transaction(async (transaction) => {
    const paymentTable = await transaction.$queryRawUnsafe(
      `SELECT to_regclass('public.organization_billing_payments') IS NOT NULL AS "exists"`
    )
    if (paymentTable[0]?.exists) {
      await transaction.$executeRawUnsafe(
        `DELETE FROM "public"."organization_billing_payments" WHERE upper("provider") = 'PAYPAL'`
      )
    }

    const organizationTable = await transaction.$queryRawUnsafe(
      `SELECT to_regclass('public.organizations') IS NOT NULL AS "exists"`
    )
    if (organizationTable[0]?.exists) {
      await transaction.$executeRawUnsafe(
        `UPDATE "public"."organizations"
         SET "billingProvider" = NULL,
             "billingStatus" = NULL,
             "billingAmountMinor" = NULL,
             "billingCurrency" = NULL,
             "billingCurrentPeriodStart" = NULL,
             "billingCurrentPeriodEnd" = NULL,
             "billingGraceUntil" = NULL,
             "billingCancelAtPeriodEnd" = FALSE,
             "billingConsentAt" = NULL,
             "billingConsentVersion" = NULL,
             "billingLastAttemptAt" = NULL,
             "billingAttemptId" = NULL
         WHERE upper(coalesce("billingProvider", '')) = 'PAYPAL'`
      )
      await transaction.$executeRawUnsafe(
        `ALTER TABLE "public"."organizations"
         DROP COLUMN IF EXISTS "paypalOrderId",
         DROP COLUMN IF EXISTS "paypalCaptureId",
         DROP COLUMN IF EXISTS "paypalPlanPeriod"`
      )
    }

    await transaction.$executeRawUnsafe(
      `DROP TABLE IF EXISTS "public"."paypal_organization_purchases"`
    )
  })

  console.log('PayPal-specific checkout data removed; organization and fleet records were retained.')
}

removePayPalData()
  .catch((error) => {
    console.error(`PayPal data cleanup failed: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
