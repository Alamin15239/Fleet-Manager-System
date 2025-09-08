import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    
    // Get system statistics
    const [
      totalUsers,
      activeUsers,
      totalSessions,
      activeSessions,
      totalActions,
      criticalAlerts
    ] = await Promise.all([
      // Total users
      db.user.count(),
      
      // Active users (logged in within last 24 hours)
      db.user.count({
        where: {
          isActive: true,
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Total sessions today
      db.auditLog.count({
        where: {
          action: 'LOGIN',
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      
      // Active sessions (estimate based on recent activity)
      db.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
          }
        }
      }),
      
      // Total actions today
      db.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      
      // Critical alerts (trucks with critical risk level)
      db.truck.count({
        where: {
          riskLevel: 'CRITICAL'
        }
      })
    ])

    // Calculate system health (simple metric based on various factors)
    const systemHealth = Math.min(100, Math.max(0, 
      100 - (criticalAlerts * 10) // Reduce health by 10% per critical alert
    ))

    // Simulate response time (in production, this would be actual metrics)
    const responseTime = Math.floor(Math.random() * 200) + 50 // 50-250ms

    const stats = {
      totalUsers,
      activeUsers,
      totalSessions,
      activeSessions: Math.min(activeSessions, activeUsers), // Can't have more active sessions than active users
      totalActions,
      criticalAlerts,
      systemHealth,
      responseTime
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching system stats:', error)
    
    if (error instanceof Error) {
      if (error.message === 'No token provided' || error.message === 'Invalid token') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch system stats' },
      { status: 500 }
    )
  }
}