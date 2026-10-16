import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { runSystemHealthChecks } from '@/lib/system-health'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const result = await runSystemHealthChecks()
    return NextResponse.json({ success: result.status !== 'unhealthy', ...result })
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Health check failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 503 },
    )
  }
}
