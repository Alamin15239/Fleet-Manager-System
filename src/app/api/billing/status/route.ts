import { NextRequest, NextResponse } from 'next/server'
import { controlDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('org')?.trim().toLowerCase()
  if (!key || key.length > 80) return NextResponse.json({ error: 'Organization code is required.' }, { status: 400 })
  const organization = await (controlDb as any).organization.findFirst({
    where: { OR: [{ slug: key }, { id: key }] },
    select: { id: true, slug: true, status: true, billingStatus: true, billingCurrentPeriodEnd: true }
  })
  if (!organization) return NextResponse.json({ error: 'Checkout was not found. Start again from the annual plan page.' }, { status: 404 })
  return NextResponse.json({
    ready: organization.status === 'ACTIVE' && organization.billingStatus === 'ACTIVE',
    organizationSlug: organization.slug,
    setup: organization.status,
    payment: organization.billingStatus,
    periodEnd: organization.billingCurrentPeriodEnd
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}
