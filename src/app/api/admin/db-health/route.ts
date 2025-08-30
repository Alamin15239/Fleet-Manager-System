import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    // Test database connection
    const startTime = Date.now()
    
    // Simple query to test connection
    const userCount = await db.user.count()
    const activeUserCount = await db.user.count({
      where: { isActive: true, isDeleted: false }
    })
    const deletedUserCount = await db.user.count({
      where: { isDeleted: true }
    })
    
    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      data: {
        totalUsers: userCount,
        activeUsers: activeUserCount,
        deletedUsers: deletedUserCount,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Database health check failed:', error)
    
    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}