import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
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
    let availableSpace = null
    try {
      const sizeQuery = await db.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size,
               pg_database_size(current_database()) as size_bytes
      ` as any[]
      
      if (sizeQuery && sizeQuery[0]) {
        const usedBytes = parseInt(sizeQuery[0].size_bytes)
        const diskSpaceBytes = 1024 * 1024 * 1024 // 1GB limit for Neon free tier
        const availableBytes = Math.max(0, diskSpaceBytes - usedBytes)
        
        actualDatabaseSize = {
          formatted: sizeQuery[0].size,
          bytes: usedBytes
        }
        
        availableSpace = {
          totalGB: Math.round((diskSpaceBytes / (1024 * 1024 * 1024)) * 100) / 100,
          usedGB: Math.round((usedBytes / (1024 * 1024 * 1024)) * 100) / 100,
          availableGB: Math.round((availableBytes / (1024 * 1024 * 1024)) * 100) / 100,
          availableKB: Math.round(availableBytes / 1024),
          usagePercent: Math.round((usedBytes / diskSpaceBytes) * 100)
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
          available: availableSpace
        },
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching database storage info:', error)
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