const { PrismaClient } = require('@prisma/client')

const models = [
  'user',
  'passkeyCredential',
  'mechanic',
  'driver',
  'truck',
  'trailer',
  'maintenanceJob',
  'predictiveAlert',
  'trailerPredictiveAlert',
  'maintenanceRecord',
  'trailerMaintenanceRecord',
  'workshopJobCard',
  'settings',
  'organization',
  'organizationPurchaseRequest',
  'organizationBillingPayment',
  'stripeWebhookEvent',
  'vendor',
  'purchaseInvoice',
  'purchaseInvoiceLine',
  'fleetLedgerAccount',
  'purchaseJournalEntry',
  'purchaseJournalLine',
  'oneDriveIntegration',
  'excelWorkbookChange',
  'notification',
  'trailerNotification',
  'auditLog',
  'userActivity',
  'loginHistory',
  'vehicle',
  'vehicleType',
  'fleetVehicle',
  'vehicleDocument',
  'maintenanceType',
  'tire',
  'tireLifecycleEvent',
  'tireUsagePeriod',
  'document',
  'emailLog',
  'inventoryItem',
  'inventoryTransaction',
  'websiteVisitorSession'
]

const minimumRows = {
  maintenanceJob: 558,
  mechanic: 4,
  settings: 1,
  trailer: 36,
  truck: 43,
  user: 2,
  vehicle: 43
}

async function main() {
  const url = process.env.TIDB_DATABASE_URL
  if (!url) throw new Error('TIDB_DATABASE_URL is required')
  const parsed = new URL(url)
  if (!parsed.hostname.toLowerCase().endsWith('.tidbcloud.com') ||
      parsed.searchParams.get('sslmode') !== 'require') {
    throw new Error('Refusing to connect: expected a TLS-protected TiDB Cloud PostgreSQL URL')
  }

  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: ['error']
  })

  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT version()`
    console.log('TiDB PostgreSQL connection: OK')

    let totalRows = 0
    for (const modelName of models) {
      const model = prisma[modelName]
      if (!model || typeof model.findMany !== 'function' || typeof model.count !== 'function') {
        throw new Error(`Generated Prisma delegate missing: ${modelName}`)
      }
      // Read every model's current row shape without modifying production data.
      await model.findMany({ take: 1 })
      const count = await model.count()
      totalRows += count
      console.log(`${modelName}: OK (${count} rows)`)

      const minimum = minimumRows[modelName]
      if (minimum !== undefined && count < minimum) {
        throw new Error(`Unexpectedly low ${modelName} count: expected at least ${minimum}, found ${count}`)
      }
    }

    console.log(`TiDB Prisma read-only smoke test passed: ${models.length} models, ${totalRows} rows.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('TiDB production readiness check failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
