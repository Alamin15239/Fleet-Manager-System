'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'

export function ClarityAnalytics() {
  let user, isAuthenticated
  
  try {
    const auth = useAuth()
    user = auth.user
    isAuthenticated = auth.isAuthenticated
  } catch (error) {
    // Handle case when AuthProvider is not available (during build)
    user = null
    isAuthenticated = false
  }

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    const initClarity = async () => {
      try {
        const { default: Clarity } = await import('@microsoft/clarity')
        
        // Initialize Clarity with project ID
        Clarity.init('t4ma7qs0aj')
        
        // Identify user if authenticated
        if (isAuthenticated && user) {
          Clarity.identify(
            user.id, // custom-id (required)
            undefined, // custom-session-id (optional)
            undefined, // custom-page-id (optional)
            user.name || user.email // friendly-name (optional)
          )
          
          // Set user tags for better filtering
          Clarity.setTag('user_role', user.role)
          Clarity.setTag('user_email', user.email)
          if (user.name) Clarity.setTag('user_name', user.name)
          if (user.department) Clarity.setTag('department', user.department)
        }
        
        console.log('Microsoft Clarity initialized')
      } catch (error) {
        console.error('Failed to initialize Clarity:', error)
      }
    }

    initClarity()
  }, [isAuthenticated, user])

  // Don't render anything during SSR
  if (typeof window === 'undefined') return null
  
  return null
}