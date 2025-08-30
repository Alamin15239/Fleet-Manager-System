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
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t(titleKey)}</h1>
        <p className="text-muted-foreground">{t(subtitleKey)}</p>
      </div>
      {children}
    </div>
  )
}