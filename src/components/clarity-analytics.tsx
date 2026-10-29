'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'

declare global {
  interface Window {
    clarity: any
  }
}

const CLARITY_PROJECT_IDS = ['yyrs1ylk71', 'z5aeaq23gi']

export function ClarityAnalytics() {
  let user, isAuthenticated

  try {
    const auth = useAuth()
    user = auth.user
    isAuthenticated = auth.isAuthenticated
  } catch {
    user = null
    isAuthenticated = false
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialize the shared Clarity queue once, then load both project tags.
    window.clarity = window.clarity || function (...args: any[]) {
      (window.clarity.q = window.clarity.q || []).push(args)
    }

    const scripts = CLARITY_PROJECT_IDS.map((projectId) => {
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = true
      script.src = `https://www.clarity.ms/tag/${projectId}`
      script.dataset.clarityProject = projectId
      document.head.appendChild(script)
      return script
    })

    // Attach identifying/custom data only after the shared Clarity API exists.
    // Avoid sending sensitive account fields such as email to analytics.
    if (isAuthenticated && user) {
      window.clarity('identify', String(user.id), undefined, undefined, user.name || undefined)
      if (user.role) window.clarity('set', 'user_role', String(user.role))
      if (user.name) window.clarity('set', 'user_name', String(user.name))
    }

    return () => {
      scripts.forEach((script) => {
        if (script.parentNode) script.parentNode.removeChild(script)
      })
    }
  }, [isAuthenticated, user])

  return null
}
