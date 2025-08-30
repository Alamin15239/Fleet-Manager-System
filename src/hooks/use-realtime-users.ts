import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface User {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'MANAGER' | 'USER'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const useRealtimeUsers = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async (showLoading = false) => {
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
        throw new Error(`HTTP error! status: ${response.status}`)
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
  }, [])

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

  const createUser = useCallback(async (userData: any) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return false

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      if (response.ok) {
        toast.success('User created successfully')
        // Force refresh to get the new user
        setTimeout(() => fetchUsers(), 500)
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create user')
        return false
      }
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Failed to create user')
      return false
    }
  }, [fetchUsers])

  const updateUser = useCallback(async (userId: string, userData: any) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return false

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

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchUsers(true)
    
    const interval = setInterval(() => {
      fetchUsers(false)
    }, 10000)
    
    return () => clearInterval(interval)
  }, [fetchUsers])

  return {
    users,
    loading,
    error,
    fetchUsers,
    deleteUser,
    createUser,
    updateUser,
    refresh: () => fetchUsers(true)
  }
}