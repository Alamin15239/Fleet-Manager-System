'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

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
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
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
    // Check for existing auth state on mount
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    const savedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null

    const initializeAuth = async () => {
      let token = savedToken
      let user = savedUser

      // If no token in localStorage, check cookies
      if (!token && typeof window !== 'undefined') {
        const cookies = document.cookie.split(';')
        const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth-token='))
        if (authCookie) {
          token = authCookie.split('=')[1]
          console.log('Found token in cookie during initialization')
          // Store it in localStorage
          localStorage.setItem('authToken', token)
        }
      }

      if (token && user) {
        try {
          let parsedUser
          try {
            parsedUser = JSON.parse(user)
          } catch (parseError) {
            console.error('Error parsing user data from localStorage:', parseError)
            // Clear invalid data
            localStorage.removeItem('authToken')
            localStorage.removeItem('user')
            setToken(null)
            setUser(null)
            setIsLoading(false)
            return
          }
          
          // Verify token is still valid by checking with server
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (response.ok) {
            setToken(token)
            setUser(parsedUser)
            console.log('Auth initialized successfully from stored data')
          } else {
            // Token is invalid, clear storage
            localStorage.removeItem('authToken')
            localStorage.removeItem('user')
            setToken(null)
            setUser(null)
            console.log('Stored token was invalid, cleared auth data')
          }
        } catch (error) {
          console.error('Error validating saved auth:', error)
          // Clear invalid data
          localStorage.removeItem('authToken')
          localStorage.removeItem('user')
          setToken(null)
          setUser(null)
        }
      } else {
        console.log('No auth data found during initialization')
      }
      setIsLoading(false)
    }

    // Only run on client side
    if (typeof window !== 'undefined') {
      initializeAuth()
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies in the request
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        // Validate the data structure before storing
        if (data.token && data.user && typeof data.user === 'object') {
          // Note: Removed email verification and approval checks
          // Users can now log in regardless of verification/approval status
          // These will be checked at feature level instead
          
          console.log('Login successful - storing token and user data')
          
          // Safely store in localStorage first
          try {
            localStorage.setItem('authToken', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
            console.log('Auth data stored in localStorage successfully')
          } catch (storageError) {
            console.error('Error storing auth data in localStorage:', storageError)
          }
          
          // Then update state
          setToken(data.token)
          setUser(data.user)
          
          return true
        } else {
          console.error('Invalid login response structure:', data)
          return false
        }
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      throw error // Re-throw to let the component handle the error message
    }
  }

  const refreshUser = async (): Promise<void> => {
    if (!token) return
    
    try {
      const response = await fetch('/api/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const userData = data.user
        setUser(userData)
        localStorage.setItem('user', JSON.stringify(userData))
        console.log('User data refreshed:', userData)
        
        // Force re-render of components using user data
        setUser(prevUser => ({ ...userData }))
      }
    } catch (error) {
      console.error('Error refreshing user data:', error)
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
      
      // Redirect to login page
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    if (fallback) {
      return <>{fallback}</>
    }
    window.location.href = '/login'
    return null
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
            onClick={() => window.location.href = '/'}
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