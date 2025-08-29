import { NextRequest } from 'next/server'
import { requireAuth } from './auth'
import { PermissionManager } from './permissions'
import { db } from './db'

export async function checkPermission(
  request: NextRequest, 
  resource: string, 
  action: string
): Promise<{ user: any; hasPermission: boolean }> {
  const user = await requireAuth(request)
  
  // Get settings permissions
  const settings = await db.settings.findFirst()
  const rolePermissions = settings?.rolePermissions as any
  
  // Create permission manager
  const permissionManager = new PermissionManager(user.role, user.id, user.permissions)
  
  if (rolePermissions) {
    permissionManager.setSettingsPermissions({ 
      rolePermissions, 
      userPermissions: settings?.userPermissions as any || {} 
    })
  }
  
  const hasPermission = permissionManager.hasPermission(resource, action)
  
  return { user, hasPermission }
}

export async function requirePermission(
  request: NextRequest, 
  resource: string, 
  action: string
): Promise<any> {
  const { user, hasPermission } = await checkPermission(request, resource, action)
  
  if (!hasPermission) {
    throw new Error(`Insufficient permissions: ${action} ${resource}`)
  }
  
  return user
}