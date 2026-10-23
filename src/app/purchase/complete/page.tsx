import { Suspense } from 'react'
import { LoaderCircle } from 'lucide-react'
import { PurchaseCompletionStatus } from '@/components/purchase-completion-status'

export const dynamic = 'force-dynamic'

export default function PurchaseCompletePage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin" /></main>}><PurchaseCompletionStatus /></Suspense>
}
