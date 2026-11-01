'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replace(/-/g, '')
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function VisitorTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    let visitorId = localStorage.getItem('fmp_visitor_id')
    if (!visitorId) {
      visitorId = makeId()
      localStorage.setItem('fmp_visitor_id', visitorId)
    }
    let sessionId = sessionStorage.getItem('fmp_session_id')
    const priorSeen = Number(sessionStorage.getItem('fmp_last_seen') || 0)
    if (!sessionId || (priorSeen > 0 && Date.now() - priorSeen > 30 * 60 * 1000)) {
      sessionId = makeId()
      sessionStorage.setItem('fmp_session_id', sessionId)
    }

    const query = new URLSearchParams(window.location.search)
    let lastInteraction = Date.now()
    const markInteraction = () => { lastInteraction = Date.now() }
    const send = (eventType: 'pageview' | 'heartbeat') => {
      sessionStorage.setItem('fmp_last_seen', String(Date.now()))
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
        eventType, isIdle: Date.now() - lastInteraction > 2 * 60 * 1000,
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
    const interactionEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    interactionEvents.forEach(event => window.addEventListener(event, markInteraction, { passive: true }))
    return () => {
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisible)
      interactionEvents.forEach(event => window.removeEventListener(event, markInteraction))
    }
  }, [pathname])

  return null
}
