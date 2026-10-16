'use client'

import { FileText } from 'lucide-react'
import { AppDocumentPage } from '@/components/app-document-page'
import { userAgreement } from '@/lib/app-documents'

export default function AgreementPage() {
  return <AppDocumentPage english={userAgreement.en} arabic={userAgreement.ar} icon={FileText} />
}
