import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    errorFormat: 'pretty',
    transactionOptions: {
      timeout: 10000,
      maxWait: 5000,
    },
  })

// Database reconnection helper
export async function reconnectDB() {
  try {
    await db.$disconnect()
    await new Promise(resolve => setTimeout(resolve, 1000))
    await db.$connect()
    return true
  } catch (error) {
    console.error('DB reconnection failed:', error)
    return false
  }
}

// Force disconnect and reconnect on connection issues
process.on('beforeExit', async () => {
  await db.$disconnect()
})

process.on('SIGINT', async () => {
  await db.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await db.$disconnect()
  process.exit(0)
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export const prisma = db