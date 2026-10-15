import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from './auth'
import { db } from './db'
import { PermissionManager, SettingsPermissions, adminPermissions, defaultPermissions, managerPermissions, normalizeRolePermissions, normalizePermissionOverrides } from './permissions'

export async function requireRolePermission(
  request: NextRequest,
  resource: string,
  action: string = 'read'
) {
  const { user, permissionManager } = await getRolePermissionManager(request)

  if (!permissionManager.hasPermission(resource, action)) {
    throw new Error('Insufficient permissions')
  }
  return user
}

export async function getRolePermissionManager(request: NextRequest) {
  const user = await requireAuth(request)
  const settings = await db.settings.findFirst({
    select: { rolePermissions: true, userPermissions: true }
  })
  const permissionManager = new PermissionManager(user.role, user.id, user.permissions)
  const storedRolePermissions = (settings?.rolePermissions || {
    ADMIN: adminPermissions,
    MANAGER: managerPermissions,
    USER: defaultPermissions
  }) as unknown as Record<string, unknown>
  const storedUserPermissions = (settings?.userPermissions || {}) as unknown as Record<string, unknown>
  permissionManager.setSettingsPermissions({
    rolePermissions: Object.fromEntries(
      Object.entries(storedRolePermissions).map(([role, permissions]) => [role, normalizeRolePermissions(permissions)])
    ) as SettingsPermissions['rolePermissions'],
    userPermissions: Object.fromEntries(
      Object.entries(storedUserPermissions).map(([userId, permissions]) => [userId, normalizePermissionOverrides(permissions)])
    ) as SettingsPermissions['userPermissions']
  })
  return { user, permissionManager }
}

export async function requirePermission(
  request: NextRequest,
  resource: string,
  action: string = 'read'
) {
  try {
    const { user, permissionManager } = await getRolePermissionManager(request)
    if (!permissionManager.hasPermission(resource, action)) {
      throw new Error('Insufficient permissions')
    }

    return { user, permissionManager }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed'
    const status = message === 'Insufficient permissions' ? 403 :
      ['No token provided', 'Invalid token'].includes(message) ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export function withPermission(resource: string, action: string = 'read') {
  return function (handler: (...args: any[]) => any) {
    return async function (request: NextRequest, ...args: any[]) {
      const authResult = await requirePermission(request, resource, action)
      
      if (authResult instanceof NextResponse) {
        return authResult
      }

      return handler(request, authResult, ...args)
    }
  }
}
