'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LocalizedText } from '@/components/localized-text'
import { Loader2 } from 'lucide-react'

export function GoogleAuthButton({
  organizationSlug,
  flow,
}: {
  organizationSlug?: string
  flow: 'login' | 'signup'
}) {
  const [connecting, setConnecting] = useState(false)

  const startGoogleAuth = () => {
    if (connecting) return
    setConnecting(true)
    const params = new URLSearchParams({ flow })
    if (organizationSlug?.trim()) params.set('org', organizationSlug.trim())
    window.location.assign(`/api/auth/google?${params.toString()}`)
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-3 border-slate-300 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      onClick={startGoogleAuth}
      disabled={connecting}
      aria-busy={connecting}
    >
      {connecting ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.57 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.73 6C44.43 38.06 46.98 31.9 46.98 24.55Z" transform="translate(0 0)" />
          <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.85 23.85 0 0 0 0 24c0 3.87.93 7.52 2.57 10.78l7.96-6.19Z" transform="translate(0 0)" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.87 2.3-8.18 2.3-6.26 0-11.57-4.07-13.47-9.62l-7.98 6.2C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -4)" />
        </svg>
      )}
      <LocalizedText>{connecting ? 'Connecting to Google...' : 'Continue with Google'}</LocalizedText>
    </Button>
  )
}

export function AuthDivider() {
  return (
    <div className="relative py-1" aria-hidden="true">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wide">
        <span className="bg-card px-3 text-muted-foreground"><LocalizedText>Or continue with email</LocalizedText></span>
      </div>
    </div>
  )
}
