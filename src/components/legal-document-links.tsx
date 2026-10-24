'use client'

import Link from 'next/link'
import { LocalizedText } from '@/components/localized-text'

export function LegalDocumentLinks() {
  return (
    <nav aria-label="Legal documents" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline"><LocalizedText>Privacy Policy</LocalizedText></Link>
      <span aria-hidden="true">·</span>
      <Link href="/agreement" className="underline-offset-4 hover:text-foreground hover:underline"><LocalizedText>User Agreement</LocalizedText></Link>
      <span aria-hidden="true">·</span>
      <Link href="/help" className="underline-offset-4 hover:text-foreground hover:underline"><LocalizedText>User Guide</LocalizedText></Link>
    </nav>
  )
}
