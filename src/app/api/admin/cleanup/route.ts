import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    // Refresh PostgreSQL planner statistics without deleting fleet or user records.
    await db.$executeRawUnsafe('ANALYZE')
    await db.auditLog.create({
      data: {
        action: 'DATABASE_ANALYZE',
        entityType: 'SYSTEM',
        entityId: 'database',
        userId: admin.id,
        userName: admin.name || null,
        userEmail: admin.email,
        userRole: admin.role,
      },
    })
    return NextResponse.json({ success: true, message: 'Database statistics refreshed. No fleet or user data was deleted.' })
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    console.error('Database analyze failed:', error)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Database optimization failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 503 },
    )
  }
}
