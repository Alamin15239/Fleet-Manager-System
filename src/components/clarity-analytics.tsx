'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'

declare global {
  interface Window {
    clarity: any
  }
}

export function ClarityAnalytics() {
  let user, isAuthenticated
  
  try {
    const auth = useAuth()
    user = auth.user
    isAuthenticated = auth.isAuthenticated
  } catch (error) {
    user = null
    isAuthenticated = false
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Load Clarity script
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = `
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "t4ma7qs0aj");
    `
    
    document.head.appendChild(script)
    
    // Set user data when available
    const setUserData = () => {
      if (window.clarity && isAuthenticated && user) {
        window.clarity('identify', user.id, undefined, undefined, user.name || user.email)
        window.clarity('set', 'user_role', user.role)
        window.clarity('set', 'user_email', user.email)
        if (user.name) window.clarity('set', 'user_name', user.name)
      }
    }
    
    // Wait for clarity to load
    const checkClarity = setInterval(() => {
      if (window.clarity) {
        setUserData()
        clearInterval(checkClarity)
      }
    }, 100)
    
    return () => {
      clearInterval(checkClarity)
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [isAuthenticated, user])

  return null
}