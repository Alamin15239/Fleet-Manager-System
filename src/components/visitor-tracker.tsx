'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replace(/-/g, '')
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function VisitorTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    let visitorId = localStorage.getItem('fmp_visitor_id')
    if (!visitorId) {
      visitorId = makeId()
      localStorage.setItem('fmp_visitor_id', visitorId)
    }
    let sessionId = sessionStorage.getItem('fmp_session_id')
    if (!sessionId) {
      sessionId = makeId()
      sessionStorage.setItem('fmp_session_id', sessionId)
    }

    const query = new URLSearchParams(window.location.search)
    const send = (eventType: 'pageview' | 'heartbeat') => {
      const token = localStorage.getItem('authToken') || localStorage.getItem('auth-token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const payload = {
        visitorId, sessionId, domain: window.location.hostname,
        pagePath: window.location.pathname + window.location.search,
        referrer: document.referrer || '',
        source: query.get('utm_source') || '',
        medium: query.get('utm_medium') || '',
        campaign: query.get('utm_campaign') || '',
        eventType,
      }
      fetch('/api/analytics/visitor', {
        method: 'POST', headers, body: JSON.stringify(payload),
        keepalive: eventType === 'heartbeat',
      }).catch(() => {})
    }

    send('pageview')
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') send('heartbeat')
    }, 30000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') send('heartbeat')
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname, searchParams])

  return null
}
