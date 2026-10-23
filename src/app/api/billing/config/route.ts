import { NextResponse } from 'next/server'
import { annualOrganizationPriceSar, isTapBillingReady } from '@/lib/organization-billing'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    available: isTapBillingReady(),
    annualPriceSar: annualOrganizationPriceSar(),
    currency: 'SAR',
    interval: 'year'
  }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}
