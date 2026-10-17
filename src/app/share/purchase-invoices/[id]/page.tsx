import PurchaseInvoiceShareView from '@/components/purchase-invoice-share-view'

export const metadata = {
  title: 'Shared Purchase Invoice',
  robots: { index: false, follow: false },
}

export default function SharedPurchaseInvoicePage() {
  return <PurchaseInvoiceShareView />
}
