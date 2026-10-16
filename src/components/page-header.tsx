'use client'

import { useLanguage } from '@/contexts/language-context'

interface PageHeaderProps {
  titleKey: string
  subtitleKey: string
  children?: React.ReactNode
}

export function PageHeader({ titleKey, subtitleKey, children }: PageHeaderProps) {
  const { t } = useLanguage()

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t(titleKey)}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">{t(subtitleKey)}</p>
      </div>
      {children && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{children}</div>}
    </div>
  )
}
