'use client'

import { ReactNode } from 'react'
import { usePermissions as useRolePermissions } from '@/contexts/permissions-context'

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
  const { hasPermission, loading } = useRolePermissions()

  if (loading) return <>{fallback}</>

  // Check single permission
  if (resource && action) {
    if (!hasPermission(resource, action)) {
      return <>{fallback}</>
    }
  }

  // Check multiple permissions
  if (permissions.length > 0) {
    const hasPermissions = permissions.map(perm => {
      const [res, act] = perm.split(':')
      return hasPermission(res, act || 'read')
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

export const usePermissions = useRolePermissions
