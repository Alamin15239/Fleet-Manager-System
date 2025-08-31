'use client'

import { useEffect } from 'react'
import { StorageUtils } from '@/lib/storage-utils'

export function StorageInit() {
  useEffect(() => {
    // Initialize modern storage APIs on client side
    if (typeof window !== 'undefined') {
      StorageUtils.initializeStorage()
    }
  }, [])

  return null // This component doesn't render anything
}