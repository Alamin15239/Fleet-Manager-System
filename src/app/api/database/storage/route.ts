import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [
      userCount,
      truckCount,
      maintenanceCount,
      tireCount,
      mechanicCount,
      notificationCount,
      auditLogCount,
      documentCount
    ] = await Promise.all([
      db.user.count(),
      db.truck.count(),
      db.maintenanceRecord.count(),
      db.tire.count(),
      db.mechanic.count(),
      db.notification.count(),
      db.auditLog.count(),
      db.document.count()
    ])

    const estimatedStorage = {
      users: userCount * 2,
      trucks: truckCount * 3,
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
    try {
      const sizeQuery = await db.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size,
               pg_database_size(current_database()) as size_bytes
      ` as any[]
      
      if (sizeQuery && sizeQuery[0]) {
        actualDatabaseSize = {
          formatted: sizeQuery[0].size,
          bytes: parseInt(sizeQuery[0].size_bytes)
        }
      }
    } catch (error) {
      console.log('Using estimation for database size')
    }

    return NextResponse.json({
      success: true,
      data: {
        tableCounts: {
          users: userCount,
          trucks: truckCount,
          maintenance: maintenanceCount,
          tires: tireCount,
          mechanics: mechanicCount,
          notifications: notificationCount,
          auditLogs: auditLogCount,
          documents: documentCount,
          total: userCount + truckCount + maintenanceCount + tireCount + mechanicCount + notificationCount + auditLogCount + documentCount
        },
        storage: {
          estimated: {
            totalKB: Math.round(totalEstimatedKB * 100) / 100,
            totalMB: Math.round(totalEstimatedMB * 100) / 100,
            breakdown: estimatedStorage
          },
          actual: actualDatabaseSize
        },
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error fetching database storage info:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch database storage information' },
      { status: 500 }
    )
  }
}