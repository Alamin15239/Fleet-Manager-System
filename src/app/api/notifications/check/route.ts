import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
    return NextResponse.json(
      { success: false, error: 'Notification checks are not connected to real inventory and delivery data. No check was run.' },
      { status: 501 }
    )
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : 'Failed to run notification check' },
      { status: unauthorized ? 401 : 503 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    return NextResponse.json(
      { success: false, error: 'Notification checks are not connected to real inventory and delivery data.' },
      { status: 501 }
    )
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : 'Failed to run notification check' },
      { status: unauthorized ? 401 : 503 }
    )
  }
}
