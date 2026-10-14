import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const startedAt = Date.now()

  try {
    await requireAdmin(request)

    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const recentLoginWindow = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      recentLogins,
      totalSessions,
      activeSessions,
      totalActions,
      criticalTrucks,
      criticalTrailers,
      totalTrucks,
      activeTrucks,
      totalTrailers,
      activeTrailers,
      truckMaintenance,
      trailerMaintenance,
      jobCards,
      pendingTruckMaintenance,
      pendingTrailerMaintenance,
      pendingJobCards,
      totalTires,
      databaseSizeResult
    ] = await Promise.all([
      db.user.count({ where: { isDeleted: false } }),
      db.loginHistory.findMany({
        where: { loginTime: { gte: recentLoginWindow } },
        select: { userId: true },
        distinct: ['userId']
      }),
      db.loginHistory.count({ where: { loginTime: { gte: dayStart } } }),
      db.loginHistory.count({ where: { isActive: true } }),
      db.auditLog.count({ where: { createdAt: { gte: dayStart } } }),
      db.truck.count({ where: { isDeleted: false, riskLevel: 'CRITICAL' } }),
      db.trailer.count({ where: { isDeleted: false, riskLevel: 'CRITICAL' } }),
      db.truck.count({ where: { isDeleted: false } }),
      db.truck.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      db.trailer.count({ where: { isDeleted: false } }),
      db.trailer.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      db.maintenanceRecord.count({ where: { isDeleted: false } }),
      db.trailerMaintenanceRecord.count({ where: { isDeleted: false } }),
      db.workshopJobCard.count(),
      db.maintenanceRecord.count({ where: { isDeleted: false, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
      db.trailerMaintenanceRecord.count({ where: { isDeleted: false, status: { in: ['SCHEDULED', 'IN_PROGRESS'] } } }),
      db.workshopJobCard.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      db.tire.count(),
      db.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database()) AS bytes`
    ])

    const databaseBytes = Number(databaseSizeResult[0]?.bytes || 0)
    const stats = {
      totalUsers,
      activeUsers: recentLogins.length,
      totalSessions,
      activeSessions,
      totalActions,
      criticalAlerts: criticalTrucks + criticalTrailers,
      systemHealth: null,
      responseTime: Date.now() - startedAt,
      totalTrucks,
      activeTrucks,
      totalTrailers,
      activeTrailers,
      totalMaintenance: truckMaintenance + trailerMaintenance + jobCards,
      pendingMaintenance: pendingTruckMaintenance + pendingTrailerMaintenance + pendingJobCards,
      totalTires,
      databaseSize: `${(databaseBytes / (1024 * 1024)).toFixed(1)} MB`,
      uptime: 'Not available',
      lastBackup: 'Not recorded'
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching system stats:', error)

    if (error instanceof Error) {
      if (['No token provided', 'Invalid token'].includes(error.message)) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }

    return NextResponse.json({ error: 'Failed to fetch system stats' }, { status: 503 })
  }
}
