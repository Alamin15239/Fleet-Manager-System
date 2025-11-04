import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from './auth'
import { PermissionManager } from './permissions'

export async function requirePermission(
  request: NextRequest,
  resource: string,
  action: string = 'read'
) {
  try {
    const user = await requireAuth(request)
    
    const permissionManager = new PermissionManager(
      user.role,
      user.id,
      user.permissions
    )

    if (!permissionManager.hasPermission(resource, action)) {
      return NextResponse.json(
        { error: `Access denied. Required permission: ${resource}:${action}` },
        { status: 403 }
      )
    }

    return { user, permissionManager }
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    )
  }
}

export function withPermission(resource: string, action: string = 'read') {
  return function (handler: Function) {
    return async function (request: NextRequest, ...args: any[]) {
      const authResult = await requirePermission(request, resource, action)
      
      if (authResult instanceof NextResponse) {
        return authResult
      }

      return handler(request, authResult, ...args)
    }
  }
}