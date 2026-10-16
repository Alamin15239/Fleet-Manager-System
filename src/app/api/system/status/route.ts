import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { runSystemHealthChecks } from '@/lib/system-health'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await runSystemHealthChecks(), {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'System status check failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 503 },
    )
  }
}
