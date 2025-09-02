'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSocket } from '../hooks/useSocket'
import { toast } from 'sonner'

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
  const { socket, isConnected } = useSocket()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    if (!socket) return

    socket.on('tire-created', (data) => {
      toast.success(`${data.count} tire(s) added for ${data.plateNumber || 'inventory'}`)
      setRefreshTrigger(prev => prev + 1)
    })

    socket.on('truck-updated', (data) => {
      toast.info(`Truck ${data.licensePlate} updated`)
      setRefreshTrigger(prev => prev + 1)
    })

    socket.on('maintenance-created', (data) => {
      toast.info(`New maintenance record for ${data.truckId}`)
      setRefreshTrigger(prev => prev + 1)
    })

    return () => {
      socket.off('tire-created')
      socket.off('truck-updated')
      socket.off('maintenance-created')
    }
  }, [socket])

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <RealTimeContext.Provider value={{ isConnected, refreshData }}>
      {children}
    </RealTimeContext.Provider>
  )
}