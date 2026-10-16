'use client'

import { ShieldCheck } from 'lucide-react'
import { AppDocumentPage } from '@/components/app-document-page'
import { privacyPolicy } from '@/lib/app-documents'

export default function PrivacyPage() {
  return <AppDocumentPage english={privacyPolicy.en} arabic={privacyPolicy.ar} icon={ShieldCheck} />
}
