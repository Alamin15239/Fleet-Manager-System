'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from '../src/contexts/auth-context'
import { apiGet } from '../src/lib/api'

interface RealTimeContextType {
  isConnected: boolean
  refreshData: () => void
}

const RealTimeContext = createContext<RealTimeContextType>({
  isConnected: false,
  refreshData: () => {}
})

export const useRealTime = () => useContext(RealTimeContext)

export function RealTimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuth()
  const [isConnected, setIsConnected] = useState(false)

  const refreshData = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fleet:data-changed', { detail: { source: 'manual' } }))
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setIsConnected(false)
      return
    }

    let stopped = false
    let lastVersion: string | null = null
    let checking = false

    const checkForChanges = async () => {
      if (stopped || checking || document.visibilityState !== 'visible') return
      checking = true
      try {
        const response = await apiGet('/api/realtime/changes')
        if (!response.ok) throw new Error(`Realtime check failed (${response.status})`)
        const payload = await response.json() as { version?: string }
        if (!payload.version) throw new Error('Realtime version missing')
        if (lastVersion !== null && payload.version !== lastVersion) {
          window.dispatchEvent(new CustomEvent('fleet:data-changed', {
            detail: { version: payload.version, source: 'database' }
          }))
        }
        lastVersion = payload.version
        if (!stopped) setIsConnected(true)
      } catch (error) {
        if (!stopped) setIsConnected(false)
        console.warn('Fleet data update check failed:', error)
      } finally {
        checking = false
      }
    }

    void checkForChanges()
    const interval = window.setInterval(() => { void checkForChanges() }, 12000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForChanges()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stopped = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [isAuthenticated, token])

  return (
    <RealTimeContext.Provider value={{ isConnected, refreshData }}>
      {children}
    </RealTimeContext.Provider>
  )
}
