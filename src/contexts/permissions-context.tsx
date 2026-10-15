'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { PermissionManager, SettingsPermissions, defaultPermissions, adminPermissions, managerPermissions, normalizeRolePermissions, normalizePermissionOverrides } from '@/lib/permissions'
import { useAuth } from '@/contexts/auth-context'
import { apiGet } from '@/lib/api'

interface PermissionsContextType {
  permissionManager: PermissionManager | null
  settingsPermissions: SettingsPermissions | null
  loading: boolean
  isLoading: boolean
  hasPermission: (resource: string, action: string) => boolean
  canAccess: (resource: string) => boolean
  canCreate: (resource: string) => boolean
  canUpdate: (resource: string) => boolean
  canDelete: (resource: string) => boolean
  canExport: (resource: string) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth()
  const [permissionManager, setPermissionManager] = useState<PermissionManager | null>(null)
  const [settingsPermissions, setSettingsPermissions] = useState<SettingsPermissions | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPermissions = async () => {
    setLoading(true)
    try {
      const [profileResponse, response] = await Promise.all([
        apiGet('/api/auth/me'),
        apiGet('/api/settings')
      ])
      let effectiveUser = user

      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        const freshUser = profileData.user
        if (freshUser && (!user ||
          user.id !== freshUser.id ||
          user.role !== freshUser.role ||
          user.isActive !== freshUser.isActive ||
          user.isApproved !== freshUser.isApproved ||
          JSON.stringify(Object.entries(user.permissions || {}).sort(([a], [b]) => a.localeCompare(b))) !==
            JSON.stringify(Object.entries(freshUser.permissions || {}).sort(([a], [b]) => a.localeCompare(b))))) {
          updateUser(freshUser)
        }
        if (freshUser) effectiveUser = freshUser
      }

      if (response.ok) {
        const settings = await response.json()
        const storedRolePermissions = settings.rolePermissions || {
          ADMIN: adminPermissions,
          MANAGER: managerPermissions,
          USER: defaultPermissions
        }
        const permissions: SettingsPermissions = {
          rolePermissions: Object.fromEntries(
            Object.entries(storedRolePermissions).map(([role, rolePermissions]) => [
              role,
              normalizeRolePermissions(rolePermissions)
            ])
          ),
          userPermissions: Object.fromEntries(
            Object.entries(settings.userPermissions || {}).map(([userId, userPermissions]) => [
              userId,
              normalizePermissionOverrides(userPermissions)
            ])
          )
        }
        
        setSettingsPermissions(permissions)
        
        if (effectiveUser) {
          const manager = new PermissionManager(
            effectiveUser.role,
            effectiveUser.id,
            effectiveUser.permissions
          )
          manager.setSettingsPermissions(permissions)
          setPermissionManager(manager)
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      // Use default permissions if fetch fails
      setSettingsPermissions({
        rolePermissions: {
          ADMIN: adminPermissions,
          MANAGER: managerPermissions,
          USER: defaultPermissions
        },
        userPermissions: {}
      })
      if (user) {
        const manager = new PermissionManager(user.role, user.id, user.permissions)
        manager.setSettingsPermissions({
          rolePermissions: {
            ADMIN: adminPermissions,
            MANAGER: managerPermissions,
            USER: defaultPermissions
          },
          userPermissions: {}
        })
        setPermissionManager(manager)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      setPermissionManager(null)
      setSettingsPermissions(null)
      setLoading(false)
      return
    }

    fetchPermissions()
    const refreshOnFocus = () => { void fetchPermissions() }
    window.addEventListener('focus', refreshOnFocus)
    return () => window.removeEventListener('focus', refreshOnFocus)
  }, [user])

  const hasPermission = (resource: string, action: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.hasPermission(resource, action)
  }

  const canAccess = (resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canAccess(resource)
  }

  const canCreate = (resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canCreate(resource)
  }

  const canUpdate = (resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canUpdate(resource)
  }

  const canDelete = (resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canDelete(resource)
  }

  const canExport = (resource: string): boolean => {
    if (!permissionManager) return false
    return permissionManager.canExport(resource)
  }

  const refreshPermissions = async () => {
    await fetchPermissions()
  }

  return (
    <PermissionsContext.Provider
      value={{
        permissionManager,
        settingsPermissions,
        loading,
        isLoading: loading,
        hasPermission,
        canAccess,
        canCreate,
        canUpdate,
        canDelete,
        canExport,
        refreshPermissions
      }}
    >
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }
  return context
}
