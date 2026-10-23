import type { Metadata } from 'next'
import { RotateCcw } from 'lucide-react'
import { AppDocumentPage } from '@/components/app-document-page'
import { refundPolicy } from '@/lib/app-documents'

export const metadata: Metadata = {
  title: 'Refund Policy | Fleet Manager Pro',
  description: 'Refund and annual subscription cancellation information for Fleet Manager Pro organization plans.',
  alternates: { canonical: 'https://fleetmaintenance.site/refund-policy' },
}

export default function RefundPolicyPage() {
  return (
    <AppDocumentPage
      english={refundPolicy.en}
      arabic={refundPolicy.ar}
      icon={RotateCcw}
      updatedDate={{ en: '24 October 2026', ar: '24 أكتوبر 2026' }}
    />
  )
}
