import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@/lib/db'

export type SystemCheck = {
  status: 'operational' | 'warning' | 'error'
  message: string
}

export async function runSystemHealthChecks() {
  const checks: {
    authentication: SystemCheck
    database: SystemCheck
    fileStorage: SystemCheck
    reportGeneration: SystemCheck
  } = {
    authentication: { status: 'error', message: 'Not checked' },
    database: { status: 'error', message: 'Not checked' },
    fileStorage: { status: 'warning', message: 'Not checked' },
    reportGeneration: { status: 'error', message: 'Not checked' },
  }

  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: 'operational', message: 'Database connection is healthy' }
  } catch {
    checks.database = { status: 'error', message: 'Database connection failed' }
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    checks.authentication = { status: 'operational', message: 'Authentication secret is configured' }
  } else {
    checks.authentication = { status: 'error', message: 'Authentication secret is missing or too short' }
  }

  if (process.env.VERCEL === '1') {
    checks.fileStorage = {
      status: 'warning',
      message: 'Profile images use the database; generic uploaded files need persistent storage',
    }
  } else {
    const uploadsDirectory = join(process.cwd(), 'public', 'uploads')
    checks.fileStorage = existsSync(uploadsDirectory)
      ? { status: 'operational', message: 'Local uploads directory is available' }
      : { status: 'warning', message: 'Local uploads directory is not configured' }
  }

  try {
    await db.workshopJobCard.count()
    checks.reportGeneration = { status: 'operational', message: 'Job card data is available for reports' }
  } catch {
    checks.reportGeneration = { status: 'error', message: 'Job card report data could not be read' }
  }

  const values = Object.values(checks)
  const status = values.some((check) => check.status === 'error')
    ? 'unhealthy'
    : values.some((check) => check.status === 'warning')
      ? 'degraded'
      : 'healthy'

  return { status, timestamp: new Date().toISOString(), checks }
}
