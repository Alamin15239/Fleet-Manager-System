import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getPrismaWorkspaceStorageUsage } from '@/lib/organization-provisioning'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timeout')), 8000)
    })

    const counts = await Promise.race([
      Promise.all([
        db.user.count(),
        db.truck.count(),
        db.trailer.count(),
        db.maintenanceRecord.count(),
        db.tire.count(),
        db.mechanic.count(),
        db.notification.count(),
        db.auditLog.count(),
        db.document.count()
      ]),
      timeoutPromise
    ]) as number[];

    const [
      userCount,
      truckCount,
      trailerCount,
      maintenanceCount,
      tireCount,
      mechanicCount,
      notificationCount,
      auditLogCount,
      documentCount
    ] = counts

    const estimatedStorage = {
      users: userCount * 2,
      trucks: truckCount * 3,
      trailers: trailerCount * 2,
      maintenance: maintenanceCount * 1.5,
      tires: tireCount * 1,
      mechanics: mechanicCount * 1,
      notifications: notificationCount * 0.5,
      auditLogs: auditLogCount * 2,
      documents: documentCount * 10
    }

    const totalEstimatedKB = Object.values(estimatedStorage).reduce((sum, size) => sum + size, 0)
    const totalEstimatedMB = totalEstimatedKB / 1024

    let actualDatabaseSize = null
    // Prisma Postgres storage is shared across its workspace, so obtain the
    // aggregate usage and plan limit from Prisma's server-side REST API.
    let providerStorage = null
    let providerStorageStatus: 'available' | 'unavailable' | 'not-configured' = 'not-configured'
    if (process.env.PRISMA_SERVICE_TOKEN && process.env.PRISMA_PROJECT_ID) {
      try {
        providerStorage = await getPrismaWorkspaceStorageUsage()
        providerStorageStatus = 'available'
      } catch (error) {
        providerStorageStatus = 'unavailable'
        console.error('Prisma workspace storage check failed:', error)
      }
    }

    try {
      const sizeQuery = await db.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size,
               pg_database_size(current_database()) as size_bytes
      ` as any[]
      
      if (sizeQuery && sizeQuery[0]) {
        const usedBytes = parseInt(sizeQuery[0].size_bytes)
        
        actualDatabaseSize = {
          formatted: sizeQuery[0].size,
          bytes: usedBytes
        }
      }
    } catch (error) {
      console.log('Database size query failed, using estimation')
    }

    return NextResponse.json({
      success: true,
      data: {
        tableCounts: {
          users: userCount,
          trucks: truckCount,
          trailers: trailerCount,
          maintenance: maintenanceCount,
          tires: tireCount,
          mechanics: mechanicCount,
          notifications: notificationCount,
          auditLogs: auditLogCount,
          documents: documentCount,
          total: userCount + truckCount + trailerCount + maintenanceCount + tireCount + mechanicCount + notificationCount + auditLogCount + documentCount
        },
        storage: {
          estimated: {
            totalKB: Math.round(totalEstimatedKB * 100) / 100,
            totalMB: Math.round(totalEstimatedMB * 100) / 100,
            breakdown: estimatedStorage
          },
          actual: actualDatabaseSize,
          providerStorage,
          providerStorageStatus
        },
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching database storage info:', error)
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ success: false, error: 'Administrator access required' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Database operation timeout') {
      return NextResponse.json(
        { success: false, error: 'Database connection timeout. Please try again.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch database storage information' },
      { status: 500 }
    )
  }
}
