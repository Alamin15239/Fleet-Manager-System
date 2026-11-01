'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '')
    }
  } catch {
    // Fall through to a non-cryptographic, anonymous session identifier.
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function safeGet(storage: Storage, key: string) {
  try { return storage.getItem(key) } catch { return null }
}
function safeSet(storage: Storage, key: string, value: string) {
  try { storage.setItem(key, value) } catch { /* Tracking must never interrupt the app. */ }
}

export function VisitorTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || typeof window === 'undefined') return

    // Analytics is strictly non-blocking: storage or browser API failures must
    // never become an application-level client exception.
    try {
      const visitorStorage = window.localStorage
      const sessionStorageSafe = window.sessionStorage
      let visitorId = safeGet(visitorStorage, 'fmp_visitor_id')
      if (!visitorId) {
        visitorId = makeId()
        safeSet(visitorStorage, 'fmp_visitor_id', visitorId)
      }

      let sessionId = safeGet(sessionStorageSafe, 'fmp_session_id')
      const priorSeen = Number(safeGet(sessionStorageSafe, 'fmp_last_seen') || 0)
      if (!sessionId || (priorSeen > 0 && Date.now() - priorSeen > 30 * 60 * 1000)) {
        sessionId = makeId()
        safeSet(sessionStorageSafe, 'fmp_session_id', sessionId)
      }

      const query = new URLSearchParams(window.location.search)
      let lastInteraction = Date.now()
      const markInteraction = () => { lastInteraction = Date.now() }
      const send = (eventType: 'pageview' | 'heartbeat') => {
        try {
          safeSet(sessionStorageSafe, 'fmp_last_seen', String(Date.now()))
          const token = safeGet(visitorStorage, 'authToken') || safeGet(visitorStorage, 'auth-token')
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
          void fetch('/api/analytics/visitor', {
            method: 'POST', headers, body: JSON.stringify(payload),
            keepalive: eventType === 'heartbeat',
          }).catch(() => {})
        } catch {
          // Ignore analytics-only failures.
        }
      }

      send('pageview')
      const heartbeat = window.setInterval(() => {
        try {
          if (document.visibilityState === 'visible') send('heartbeat')
        } catch { /* Ignore browser lifecycle errors. */ }
      }, 30000)
      const onVisible = () => {
        try {
          if (document.visibilityState === 'visible') send('heartbeat')
        } catch { /* Ignore browser lifecycle errors. */ }
      }
      const interactionEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
      interactionEvents.forEach(event => window.addEventListener(event, markInteraction, { passive: true }))
      document.addEventListener('visibilitychange', onVisible)

      return () => {
        window.clearInterval(heartbeat)
        document.removeEventListener('visibilitychange', onVisible)
        interactionEvents.forEach(event => window.removeEventListener(event, markInteraction))
      }
    } catch {
      // Never let optional visitor analytics break rendering or navigation.
      return
    }
  }, [pathname])

  return null
}
