import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { createUser } from '@/lib/auth'

// GET all users (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'users', 'read')

    const users = await db.user.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json(users)

  } catch (error) {
    console.error('Error fetching users:', error)
    
    if (error instanceof Error) {
      if (error.message === 'No token provided' || error.message === 'Invalid token') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({ error: 'Unable to load users' }, { status: 503 })
  }
}

// POST create new user for callers with user-management create permission
export async function POST(request: NextRequest) {
  try {
    const caller = await requireRolePermission(request, 'users', 'create')

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      )
    }
    if (typeof body.password !== 'string' || !body.password) {
      return NextResponse.json(
        { error: 'password is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
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
    if (caller.role !== 'ADMIN' && body.role && body.role !== 'USER') {
      return NextResponse.json({ error: 'Only administrators can assign elevated roles' }, { status: 403 })
    }

    const user = await createUser({
      email,
      password: body.password,
      name: body.name,
      role: body.role || 'USER',
      permissions: caller.role === 'ADMIN' ? body.permissions || {} : {},
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      // Accounts added through user management are created by trusted staff,
      // so they should not require a second approval or email-verification step.
      isApproved: true,
      isEmailVerified: true,
      // A soft-deleted email is unique in the database; restore it from this
      // authorized management flow instead of making the UI appear to fail.
      restoreDeleted: true
    })

    // Broadcast real-time update (if socket.io is available)
    try {
      const { broadcastUserUpdate } = await import('@/lib/socket')
      const { io } = await import('@/lib/socket-server')
      if (io) {
        broadcastUserUpdate(io, 'created', user)
      }
    } catch (error) {
      console.log('Socket.io not available for real-time updates')
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User created successfully'
    })

  } catch (error) {
    console.error('Error creating user:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let errorMessage = 'Failed to create user'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.message === 'User already exists') {
        errorMessage = 'A user with this email already exists'
        statusCode = 409
      }
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      errorMessage = 'A user with this email already exists'
      statusCode = 409
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
