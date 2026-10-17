'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { TruckLoader } from '@/components/ui/truck-loader'

interface User {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'MANAGER' | 'USER'
  isActive: boolean
  isApproved: boolean
  isEmailVerified: boolean
  permissions?: any
  profileImage?: string | null
  phone?: string | null
  department?: string | null
  title?: string | null
  bio?: string | null
  createdAt?: string
  updatedAt?: string
  organizationId?: string
  organizationSlug?: string
  organizationName?: string
  isPrimaryOrganization?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, passwordOrOtp: string, isOtp?: boolean, organizationSlug?: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updateUser: (userData: Partial<User>) => void
  isLoading: boolean
  isAuthenticated: boolean
  hasRole: (role: string) => boolean
  isAdmin: boolean
  isManager: boolean
  isMechanic: boolean
  isApproved: boolean
  isEmailVerified: boolean
  canAccessFeature: (feature: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let validationId = 0

    const clearSession = (expectedToken?: string) => {
      if (expectedToken && localStorage.getItem('authToken') !== expectedToken) return
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      setToken(null)
      setUser(null)
      setIsLoading(false)
    }

    const validateSession = async (savedToken: string | null) => {
      const currentValidationId = ++validationId
      if (!savedToken) {
        setToken(null)
        setUser(null)
        setIsLoading(false)
        return
      }

      let cachedUser: User | null = null
      try {
        const cachedValue = localStorage.getItem('user')
        cachedUser = cachedValue ? JSON.parse(cachedValue) as User : null
      } catch {
        cachedUser = null
      }

      // Never render the cached identity while checking that it belongs to this token.
      setToken(savedToken)
      setUser(null)
      setIsLoading(true)

      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
          cache: 'no-store'
        })
        if (response.status === 401 || response.status === 404) {
          clearSession(savedToken)
          return
        }
        if (!response.ok) {
          throw new Error(`Session validation temporarily failed (${response.status})`)
        }

        const data = await response.json()
        const verifiedUser = data.user as User | undefined
        if (!verifiedUser?.id) throw new Error('Session response did not include an account')
        if (currentValidationId !== validationId) return
        if (localStorage.getItem('authToken') !== savedToken) return

        setToken(savedToken)
        setUser(verifiedUser)
        localStorage.setItem('user', JSON.stringify(verifiedUser))
      } catch (error) {
        console.warn('Could not validate saved account session:', error)
        // A network or server error does not invalidate a signed-in session.
        // Preserve the last known identity so a transient database outage does
        // not force the user to sign in again. Protected API routes still
        // validate the token and current account state on every request.
        if (currentValidationId === validationId && localStorage.getItem('authToken') === savedToken) {
          setToken(savedToken)
          if (cachedUser?.id) setUser(cachedUser)
        }
      } finally {
        if (currentValidationId === validationId && localStorage.getItem('authToken') === savedToken) {
          setIsLoading(false)
        }
      }
    }

    void validateSession(localStorage.getItem('authToken'))

    // Keep other open tabs in step when someone signs out or switches accounts.
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== 'authToken' && event.key !== null) return
      const nextToken = localStorage.getItem('authToken')
      if (!nextToken) {
        validationId += 1
        setToken(null)
        setUser(null)
        setIsLoading(false)
        localStorage.removeItem('user')
        return
      }
      void validateSession(nextToken)
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      validationId += 1
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem('user', JSON.stringify(user))
    }
  }, [user])

  const login = async (email: string, passwordOrOtp: string, isOtp: boolean = true, organizationSlug?: string): Promise<boolean> => {
    try {
      const endpoint = isOtp ? '/api/auth/verify-otp' : '/api/auth/login'
      const body = isOtp 
        ? { email, otp: passwordOrOtp, isLogin: true, organizationSlug }
        : { email, password: passwordOrOtp, organizationSlug }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(body)
      })

      if (response.status === 429) {
        throw new Error('Too many login attempts. Please wait a moment and try again.')
      }
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Login failed')
      }
      
      const data = await response.json()

      if (data.token && data.user) {
        localStorage.setItem('authToken', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setToken(data.token)
        setUser(data.user)
        return true
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  const refreshUser = async (): Promise<void> => {
    if (!token) return
    
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-store'
      })
      
      if (response.ok) {
        const data = await response.json()
        const userData = data.user
        if (localStorage.getItem('authToken') !== token) return
        if (!userData?.id || userData.id !== user?.id) {
          localStorage.removeItem('authToken')
          localStorage.removeItem('user')
          setToken(null)
          setUser(null)
          throw new Error('The authenticated account changed. Please sign in again.')
        }
        setUser({ ...userData })
        localStorage.setItem('user', JSON.stringify(userData))
        console.log('User data refreshed:', userData)
      } else if (response.status === 401 && localStorage.getItem('authToken') === token) {
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
      }
    } catch (error) {
      console.error('Error refreshing user data:', error)
    }
  }

  const updateUser = useCallback((userData: Partial<User>): void => {
    setUser((currentUser) => {
      if (!currentUser) return currentUser
      // Ignore a delayed profile response from a previous account/session.
      if (userData.id && userData.id !== currentUser.id) return currentUser
      return { ...currentUser, ...userData }
    })
  }, [])

  const logout = async (): Promise<void> => {
    try {
      // Call logout API to log the activity
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (error) {
      console.error('Logout API error:', error)
      // Continue with local logout even if API fails
    } finally {
      // Clear local state regardless of API call success
      setToken(null)
      setUser(null)
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      
      // Use window.location for logout to ensure complete state reset
      window.location.href = '/login'
    }
  }

  const hasRole = (role: string): boolean => {
    return user?.role === role
  }

  const canAccessFeature = (feature: string): boolean => {
    // Admins can access everything
    if (user?.role === 'ADMIN') {
      return true
    }
    
    // Check if user is approved for sensitive features
    if (feature === 'sensitive' && !user?.isApproved) {
      return false
    }
    
    // Check if user is verified for certain features
    if (feature === 'verified' && !user?.isEmailVerified) {
      return false
    }
    
    // Managers can access most features
    if (user?.role === 'MANAGER') {
      return true
    }
    
    // Regular users can access basic features
    if (user?.role === 'USER') {
      return ['basic', 'view'].includes(feature)
    }
    
    return false
  }

  const isAuthenticated = !!user && !!token
  const isAdmin = hasRole('ADMIN')
  const isManager = hasRole('MANAGER') || isAdmin
  const isMechanic = false // Mechanics are no longer users, they are separate entities
  const isApproved = user?.isApproved || false
  const isEmailVerified = user?.isEmailVerified || false

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    refreshUser,
    updateUser,
    isLoading,
    isAuthenticated,
    hasRole,
    isAdmin,
    isManager,
    isMechanic,
    isApproved,
    isEmailVerified,
    canAccessFeature
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  fallback 
}: { 
  children: React.ReactNode
  requiredRole?: string
  fallback?: React.ReactNode 
}) {
  const { isAuthenticated, isLoading, hasRole } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <TruckLoader size="lg" className="mx-auto" />
      </div>
    )
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>
    }
    // Let the layout handle authentication redirects
    return (
      <div className="flex items-center justify-center min-h-screen">
        <TruckLoader size="lg" className="mx-auto" />
      </div>
    )
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <button 
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/'
              }
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
