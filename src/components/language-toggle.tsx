'use client'

import { Button } from '@/components/ui/button'
import { Languages } from 'lucide-react'
import { useLanguage } from '@/contexts/language-context'

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="h-8 w-8 p-0"
      title={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
    >
      <Languages className="h-4 w-4" />
      <span className="sr-only">Toggle language</span>
    </Button>
  )
}