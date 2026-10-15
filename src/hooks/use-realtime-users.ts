import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/lib/localized-toast'

interface User {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'MANAGER' | 'USER'
  isActive: boolean
  isApproved: boolean
  createdAt: string
  updatedAt: string
}

type CreateUserResult =
  | { success: true }
  | { success: false; error: string }

export const useRealtimeUsers = (enabled = true) => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async (showLoading = false) => {
    if (!enabled) {
      setLoading(false)
      return
    }

    try {
      if (showLoading) setLoading(true)
      setError(null)

      const token = localStorage.getItem('authToken')
      if (!token) {
        setError('No authentication token found')
        return
      }

      // Add cache-busting and force fresh data
      const response = await fetch(`/api/users?t=${Date.now()}&fresh=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })

      if (!response.ok) {
        const responseError = await response.json().catch(() => ({}))
        throw new Error(responseError.error || `Request failed (${response.status})`)
      }

      const data = await response.json()
      const usersData = Array.isArray(data) ? data : (data.data || [])
      
      setUsers(usersData)
      console.log(`Users refreshed: ${usersData.length} users loaded`)
      
    } catch (error) {
      console.error('Error fetching users:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch users')
      toast.error('Failed to refresh users')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return false

      // Optimistically remove user from UI
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId))

      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        toast.success('User deleted successfully')
        // Force refresh to ensure consistency
        setTimeout(() => fetchUsers(), 500)
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete user')
        // Revert optimistic update
        fetchUsers()
        return false
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
      // Revert optimistic update
      fetchUsers()
      return false
    }
  }, [fetchUsers])

  const createUser = useCallback(async (userData: any): Promise<CreateUserResult> => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        const message = 'Authentication required. Please sign in again.'
        toast.error(message)
        return { success: false, error: message }
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      if (response.ok) {
        const result = await response.json().catch(() => ({}))
        const createdUser = result.data as User | undefined
        if (createdUser?.id) {
          // Show the created account immediately, even if the follow-up list
          // refresh is temporarily unavailable.
          setUsers(current => [createdUser, ...current.filter(user => user.id !== createdUser.id)])
        }
        toast.success(result.message || 'User created successfully')
        void fetchUsers()
        return { success: true }
      } else {
        const error = await response.json().catch(() => ({}))
        const message = error.error || `Failed to create user (${response.status})`
        toast.error(message)
        return { success: false, error: message }
      }
    } catch (error) {
      console.error('Error creating user:', error)
      const message = error instanceof Error ? error.message : 'Failed to create user'
      toast.error(message)
      return { success: false, error: message }
    }
  }, [fetchUsers])

  const updateUser = useCallback(async (userId: string, userData: any) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        toast.error('Authentication required')
        return false
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      if (response.ok) {
        toast.success('User updated successfully')
        // Force refresh to get updated data
        setTimeout(() => fetchUsers(), 500)
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update user')
        return false
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user')
      return false
    }
  }, [fetchUsers])

  const refresh = useCallback(() => fetchUsers(true), [fetchUsers])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }

    fetchUsers(true)
    
    const interval = setInterval(() => {
      fetchUsers(false)
    }, 10000)
    
    return () => clearInterval(interval)
  }, [enabled, fetchUsers])

  return {
    users,
    loading,
    error,
    fetchUsers,
    deleteUser,
    createUser,
    updateUser,
    refresh
  }
}
