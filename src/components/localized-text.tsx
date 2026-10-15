'use client'

import type { ReactNode } from 'react'
import { useLanguage } from '@/contexts/language-context'

/** Localizes static UI copy while leaving user-entered and database values unchanged. */
export function LocalizedText({ children }: { children: ReactNode }) {
  const { t } = useLanguage()

  if (typeof children !== 'string') return <>{children}</>

  const normalizedText = children.replace(/\s+/g, ' ').trim()
  return <>{t(normalizedText)}</>
}
