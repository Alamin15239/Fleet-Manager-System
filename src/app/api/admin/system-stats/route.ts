import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { runSystemHealthChecks } from '@/lib/system-health'

function formatInstanceUptime(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}

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
      databaseSizeResult,
      lastBackupRecord,
      systemHealth
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
      db.$queryRaw<Array<{ bytes: bigint }>>`SELECT pg_database_size(current_database()) AS bytes`,
      db.auditLog.findFirst({
        where: { action: 'DATABASE_BACKUP', entityType: 'SYSTEM' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      runSystemHealthChecks()
    ])

    const databaseBytes = Number(databaseSizeResult[0]?.bytes || 0)
    const stats = {
      totalUsers,
      activeUsers: recentLogins.length,
      totalSessions,
      activeSessions,
      totalActions,
      criticalAlerts: criticalTrucks + criticalTrailers,
      systemHealth: systemHealth.status === 'healthy' ? 'healthy' : systemHealth.status === 'degraded' ? 'warning' : 'critical',
      responseTime: Date.now() - startedAt,
      totalTrucks,
      activeTrucks,
      totalTrailers,
      activeTrailers,
      totalMaintenance: truckMaintenance + trailerMaintenance + jobCards,
      pendingMaintenance: pendingTruckMaintenance + pendingTrailerMaintenance + pendingJobCards,
      totalTires,
      databaseSize: `${(databaseBytes / (1024 * 1024)).toFixed(1)} MB`,
      uptime: formatInstanceUptime(process.uptime()),
      uptimeScope: 'Current server instance',
      lastBackup: lastBackupRecord?.createdAt.toISOString() || null,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'Not available',
      buildId: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || process.env.npm_package_version || 'Not available',
      lastUpdated: process.env.VERCEL_GIT_COMMIT_TIMESTAMP || null,
      memoryUsagePercent: process.memoryUsage().heapTotal
        ? Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        : null,
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
