import type { Metadata } from 'next'
import { annualOrganizationPriceSar, isTapBillingReady } from '@/lib/organization-billing'
import { OrganizationPurchaseForm } from '@/components/organization-purchase-form'

export const metadata: Metadata = {
  title: 'Purchase Fleet Manager Pro | Annual Organization Plan',
  robots: { index: false, follow: false }
}

export default function PurchasePage() {
  return <OrganizationPurchaseForm annualPriceSar={annualOrganizationPriceSar()} available={isTapBillingReady()} />
}
