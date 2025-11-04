'use client'

import { useAuth } from '@/contexts/auth-context'
import { PermissionManager } from '@/lib/permissions'
import { ReactNode } from 'react'

interface PermissionGuardProps {
  resource: string
  action?: string
  children: ReactNode
  fallback?: ReactNode
  requireAll?: boolean
  permissions?: string[]
}

export function PermissionGuard({
  resource,
  action = 'read',
  children,
  fallback = null,
  requireAll = false,
  permissions = []
}: PermissionGuardProps) {
  const { user } = useAuth()

  if (!user) {
    return <>{fallback}</>
  }

  const permissionManager = new PermissionManager(
    user.role,
    user.id,
    user.permissions
  )

  // Check single permission
  if (resource && action) {
    if (!permissionManager.hasPermission(resource, action)) {
      return <>{fallback}</>
    }
  }

  // Check multiple permissions
  if (permissions.length > 0) {
    const hasPermissions = permissions.map(perm => {
      const [res, act] = perm.split(':')
      return permissionManager.hasPermission(res, act || 'read')
    })

    if (requireAll) {
      if (!hasPermissions.every(Boolean)) {
        return <>{fallback}</>
      }
    } else {
      if (!hasPermissions.some(Boolean)) {
        return <>{fallback}</>
      }
    }
  }

  return <>{children}</>
}

export function usePermissions() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return new PermissionManager(user.role, user.id, user.permissions)
}