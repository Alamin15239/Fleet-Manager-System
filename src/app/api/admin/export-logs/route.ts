import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const [auditLogs, userActivities] = await Promise.all([
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: { id: true, action: true, entityType: true, entityId: true, userName: true, userEmail: true, userRole: true, ipAddress: true, createdAt: true },
      }),
      db.userActivity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000,
        select: { id: true, action: true, entityType: true, entityId: true, entityName: true, createdAt: true, user: { select: { name: true, email: true } } },
      }),
    ])

    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(JSON.stringify({
      exportedAt: new Date().toISOString(),
      limitPerSource: 1000,
      auditLogs,
      userActivities,
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="fleet-system-logs-${date}.json"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    console.error('System log export failed:', error)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'System log export failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 503 },
    )
  }
}
