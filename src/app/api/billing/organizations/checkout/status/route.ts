import { NextRequest, NextResponse } from 'next/server'
import { controlDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')?.trim()
  if (!sessionId || !/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.json({ error: 'A valid checkout session is required.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const organization = await (controlDb as any).organization.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
      select: { name: true, slug: true, status: true, billingStatus: true }
    })
    if (!organization) return NextResponse.json({ status: 'PENDING' }, { headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({
      status: organization.status === 'ACTIVE' && organization.billingStatus === 'ACTIVE' ? 'READY' : organization.billingStatus,
      organization: organization.status === 'ACTIVE' ? { name: organization.name, slug: organization.slug } : undefined
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not check checkout status.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
