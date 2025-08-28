'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { PermissionManager, SettingsPermissions, defaultPermissions, adminPermissions, managerPermissions } from '@/lib/permissions'
import { useAuth } from '@/contexts/auth-context'
import { apiGet } from '@/lib/api'

interface PermissionsContextType {
  permissionManager: PermissionManager | null
  settingsPermissions: SettingsPermissions | null
  loading: boolean
  hasPermission: (resource: string, action: string) => boolean
  canAccess: (resource: string) => boolean
  canCreate: (resource: string) => boolean
  canUpdate: (resource: string) => boolean
  canDelete: (resource: string) => boolean
  canExport: (resource: string) => boolean
  refreshPermissions: () => void
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [permissionManager, setPermissionManager] = useState<PermissionManager | null>(null)
  const [settingsPermissions, setSettingsPermissions] = useState<SettingsPermissions | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPermissions = async () => {
    try {
      const response = await apiGet('/api/settings')
      if (response.ok) {
        const settings = await response.json()
        const permissions = settings.rolePermissions && settings.userPermissions 
          ? {
              rolePermissions: settings.rolePermissions,
              userPermissions: settings.userPermissions
            }
          : {
              rolePermissions: {
                ADMIN: adminPermissions,
                MANAGER: managerPermissions,
                USER: defaultPermissions
              },
              userPermissions: {}
            }
        
        setSettingsPermissions(permissions)
        
        if (user) {
          const manager = new PermissionManager(
            user.role,
            user.id,
            user.permissions
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
    if (user && typeof window !== 'undefined') {
      fetchPermissions()
    } else {
      setLoading(false)
    }
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

  const refreshPermissions = () => {
    fetchPermissions()
  }

  return (
    <PermissionsContext.Provider
      value={{
        permissionManager,
        settingsPermissions,
        loading,
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