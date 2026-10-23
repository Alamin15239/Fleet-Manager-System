import type { Metadata } from 'next'
import { annualOrganizationPriceSar, isOrganizationBillingReady, organizationBillingProvider } from '@/lib/organization-billing'
import { OrganizationPurchaseForm } from '@/components/organization-purchase-form'
import { getConfiguredPaddlePrice } from '@/lib/paddle-billing'

export const metadata: Metadata = {
  title: 'Purchase Fleet Manager Pro | Annual Organization Plan',
  robots: { index: false, follow: false }
}

export const dynamic = 'force-dynamic'

export default async function PurchasePage() {
  const provider = organizationBillingProvider()
  const available = isOrganizationBillingReady()
  const paddleClientToken = provider === 'PADDLE' ? process.env.PADDLE_CLIENT_TOKEN?.trim() || '' : ''
  const paddleEnvironment = process.env.PADDLE_ENVIRONMENT?.trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production'
  let annualPriceMinor = annualOrganizationPriceSar() * 100
  let currency = 'SAR'
  if (provider === 'PADDLE' && available) {
    try {
      const price = await getConfiguredPaddlePrice()
      annualPriceMinor = Number(price.unit_price?.amount)
      currency = String(price.unit_price?.currency_code || 'USD').toUpperCase()
    } catch (error) {
      console.error('Paddle annual price could not be loaded for purchase page:', error instanceof Error ? error.message : 'Unknown error')
    }
  }
  return <OrganizationPurchaseForm
    annualPriceMinor={annualPriceMinor}
    currency={currency}
    available={available}
    paddleClientToken={paddleClientToken}
    paddleEnvironment={paddleEnvironment}
  />
}
