import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    
    await db.$queryRaw`SELECT 1`

    return NextResponse.json({
      success: true,
      status: 'Degraded',
      checks: {
        database: 'OK',
        authentication: 'OK',
        api: 'OK',
        persistentStorage: 'Not configured'
      }
    })
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Database health check failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 503 }
    )
  }
}
