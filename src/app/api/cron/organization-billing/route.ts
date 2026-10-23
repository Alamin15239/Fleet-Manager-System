import { NextRequest, NextResponse } from 'next/server'
import { renewDueOrganizationSubscriptions } from '@/lib/organization-billing'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await renewDueOrganizationSubscriptions()
    return NextResponse.json({ success: result.errors.length === 0, ...result }, { status: result.errors.length ? 207 : 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Annual organization subscription run failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'The annual subscription run failed.' }, { status: 500 })
  }
}
