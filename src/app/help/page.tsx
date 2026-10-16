'use client'

import { BookOpen } from 'lucide-react'
import { AppDocumentPage } from '@/components/app-document-page'
import { userGuide } from '@/lib/app-documents'

export default function HelpPage() {
  return <AppDocumentPage english={userGuide.en} arabic={userGuide.ar} icon={BookOpen} />
}
