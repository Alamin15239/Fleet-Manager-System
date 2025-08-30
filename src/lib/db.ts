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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export const prisma = db