'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
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
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, passwordOrOtp: string, isOtp?: boolean) => Promise<boolean>
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
    // Immediately set loading to false and check auth
    setIsLoading(false)
    
    if (typeof window === 'undefined') return

    const savedToken = localStorage.getItem('authToken')
    const savedUser = localStorage.getItem('user')

    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser)
        setToken(savedToken)
        setUser(parsedUser)
      } catch (error) {
        console.error('Error parsing stored user data:', error)
        localStorage.removeItem('authToken')
        localStorage.removeItem('user')
      }
    }
  }, [])

  const login = async (email: string, passwordOrOtp: string, isOtp: boolean = true): Promise<boolean> => {
    try {
      const endpoint = isOtp ? '/api/auth/verify-otp' : '/api/auth/login'
      const body = isOtp 
        ? { email, otp: passwordOrOtp, isLogin: true }
        : { email, password: passwordOrOtp }

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
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const userData = data.user
        setUser({ ...userData })
        localStorage.setItem('user', JSON.stringify(userData))
        console.log('User data refreshed:', userData)
      }
    } catch (error) {
      console.error('Error refreshing user data:', error)
    }
  }

  const updateUser = (userData: Partial<User>): void => {
    if (user) {
      const updatedUser = { ...user, ...userData }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
    }
  }

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