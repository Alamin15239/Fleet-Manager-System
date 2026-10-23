import { NextResponse } from 'next/server'
import { annualOrganizationPriceSar, isOrganizationBillingReady, organizationBillingProvider } from '@/lib/organization-billing'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    available: isOrganizationBillingReady(),
    provider: organizationBillingProvider(),
    annualPriceSar: annualOrganizationPriceSar(),
    currency: 'SAR',
    interval: 'year'
  }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}
