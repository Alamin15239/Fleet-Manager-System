import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(
      { success: false, error: 'Database backup is not configured. No backup was created.' },
      { status: 501 }
    )
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Backup request failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 500 }
    )
  }
}
