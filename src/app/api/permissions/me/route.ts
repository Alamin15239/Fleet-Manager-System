import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { adminPermissions, defaultPermissions, managerPermissions } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const settings = await db.settings.findFirst({
      select: { rolePermissions: true, userPermissions: true }
    })
    const storedUserPermissions = settings?.userPermissions && typeof settings.userPermissions === 'object'
      ? settings.userPermissions as Record<string, unknown>
      : {}

    return NextResponse.json({
      rolePermissions: settings?.rolePermissions || {
        ADMIN: adminPermissions,
        MANAGER: managerPermissions,
        USER: defaultPermissions
      },
      userPermissions: Object.prototype.hasOwnProperty.call(storedUserPermissions, user.id)
        ? { [user.id]: storedUserPermissions[user.id] }
        : {}
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load permissions'
    const status = ['No token provided', 'Invalid token', 'User not found or inactive'].includes(message) ? 401 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Unable to load permission settings' }, { status })
  }
}
