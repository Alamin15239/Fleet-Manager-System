import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { requireAdmin } from '@/lib/auth'
import { updateUser, resetPassword } from '@/lib/auth'
import { isValidPermissionOverrides, normalizePermissionOverrides } from '@/lib/permissions'

// GET single user by ID (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // This response includes login history, activity logs, and saved
    // permissions, so it is administrator-only even if list access is granted
    // to a manager role.
    await requireAdmin(request)

    const user = await db.user.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        maintenanceRecords: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            serviceType: true,
            datePerformed: true,
            totalCost: true,
            status: true
          }
        },
        auditLogs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            entityType: true,
            createdAt: true
          }
        },
        userActivities: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            entityType: true,
            createdAt: true
          }
        },
        loginHistory: {
          take: 5,
          orderBy: { loginTime: 'desc' },
          select: {
            id: true,
            loginTime: true,
            logoutTime: true,
            ipAddress: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user
    })

  } catch (error) {
    console.error('Error fetching user:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// PUT update user (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caller = await requireRolePermission(request, 'users', 'update')

    const body = await request.json()

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (caller.role !== 'ADMIN' && (existingUser.role !== 'USER' ||
      (body.role !== undefined && body.role !== 'USER') ||
      body.isApproved !== undefined || body.permissions !== undefined)) {
      return NextResponse.json({ error: 'Only administrators can change elevated roles or account permissions' }, { status: 403 })
    }
    if (id === caller.id && body.role !== undefined && body.role !== 'ADMIN') {
      return NextResponse.json({ error: 'You cannot remove administrator access from your own account' }, { status: 400 })
    }

    if (body.permissions !== undefined && !isValidPermissionOverrides(body.permissions)) {
      return NextResponse.json({ error: 'Permissions must contain only supported permission names and boolean values' }, { status: 400 })
    }

    let email: string | undefined
    if (body.email !== undefined) {
      const candidateEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(candidateEmail)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
      email = candidateEmail

      const userWithEmail = await db.user.findUnique({
        where: { email },
        select: { id: true }
      })
      if (userWithEmail && userWithEmail.id !== id) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
      }
    }

    let password: string | undefined
    if (body.password !== undefined && body.password !== '') {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
      }
      password = body.password
    }

    // Prevent self-deactivation
    if (body.isActive === false && id === caller.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['ADMIN', 'MANAGER', 'USER']
    if (body.role && !validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const updatedUser = await updateUser(id, {
      email,
      name: body.name,
      role: body.role,
      isActive: body.isActive,
      isApproved: body.isApproved,
      permissions: body.permissions === undefined ? undefined : normalizePermissionOverrides(body.permissions),
      password
    })

    // Per-user permissions now live on the User record. Remove any older
    // Settings JSON override for this account so “use role defaults” really
    // clears custom access instead of silently retaining the legacy value.
    if (body.permissions !== undefined) {
      try {
        const settings = await db.settings.findFirst({ select: { id: true, userPermissions: true } })
        if (settings?.userPermissions && typeof settings.userPermissions === 'object' && !Array.isArray(settings.userPermissions)) {
          const remainingUserPermissions = { ...(settings.userPermissions as Record<string, unknown>) }
          if (Object.prototype.hasOwnProperty.call(remainingUserPermissions, id)) {
            delete remainingUserPermissions[id]
            await db.settings.update({
              where: { id: settings.id },
              data: { userPermissions: remainingUserPermissions as any }
            })
          }
        }
      } catch (legacyCleanupError) {
        console.warn('Could not remove legacy per-user permission override:', legacyCleanupError)
      }
    }

    // Broadcast real-time update (if socket.io is available)
    try {
      const { broadcastUserUpdate } = await import('@/lib/socket')
      const { io } = await import('@/lib/socket-server')
      if (io) {
        broadcastUserUpdate(io, 'updated', updatedUser)
      }
    } catch (error) {
      console.log('Socket.io not available for real-time updates')
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    })

  } catch (error) {
    console.error('Error updating user:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE user (soft delete, admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const caller = await requireRolePermission(request, 'users', 'delete')

    // Prevent self-deletion
    if (id === caller.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (caller.role !== 'ADMIN' && user.role !== 'USER') {
      return NextResponse.json({ error: 'Only administrators can delete elevated accounts' }, { status: 403 })
    }

    // Soft delete user
    const deletedUser = await db.user.update({
      where: { id: id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: caller.id,
        isActive: false
      }
    })

    // Broadcast real-time update (if socket.io is available)
    try {
      const { broadcastUserUpdate } = await import('@/lib/socket')
      const { io } = await import('@/lib/socket-server')
      if (io) {
        broadcastUserUpdate(io, 'deleted', { id: deletedUser.id, email: deletedUser.email })
      }
    } catch (error) {
      console.log('Socket.io not available for real-time updates')
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
