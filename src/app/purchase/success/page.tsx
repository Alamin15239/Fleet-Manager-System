import PayPalPurchaseSuccess from './success-client'

type SearchParams = Promise<{ purchaseId?: string | string[]; token?: string | string[] }>

export default async function PurchaseSuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const purchaseId = Array.isArray(params.purchaseId) ? params.purchaseId[0] : params.purchaseId || ''
  const orderId = Array.isArray(params.token) ? params.token[0] : params.token || ''
  return <PayPalPurchaseSuccess purchaseId={purchaseId} orderId={orderId} />
}