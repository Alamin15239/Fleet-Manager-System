import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { createUser } from '@/lib/auth'

// GET all users (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'users', 'read')

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
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

// POST create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const caller = await requireRolePermission(request, 'users', 'create')

    const body = await request.json()

    // Validate required fields
    const requiredFields = ['email', 'password']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        )
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
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
      email: body.email,
      password: body.password,
      name: body.name,
      role: body.role || 'USER',
      permissions: caller.role === 'ADMIN' ? body.permissions || {} : {}
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
        errorMessage = 'User with this email already exists'
        statusCode = 409
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
