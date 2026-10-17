import { NextRequest, NextResponse } from 'next/server'
import { requireRolePermission } from '@/lib/permission-middleware'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateProfileSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  bio: z.string().optional(),
  profileImage: z.string().optional()
})

export async function PUT(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'profile', 'update')
    
    const body = await request.json()
    const validatedData = updateProfileSchema.parse(body)

    // Update user profile
    const updatedUser = await db.user.update({
      where: { 
        id: user.id,
        isActive: true,
        isDeleted: false 
      },
      data: validatedData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        permissions: true,
        profileImage: true,
        phone: true,
        department: true,
        title: true,
        bio: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('Update profile error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.issues },
        { status: 400 }
      )
    }

    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'You do not have permission to edit your profile' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'profile', 'read')

    // Get full user data
    const fullUser = await db.user.findUnique({
      where: { 
        id: user.id,
        isActive: true,
        isDeleted: false 
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        permissions: true,
        profileImage: true,
        phone: true,
        department: true,
        title: true,
        bio: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!fullUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: fullUser
    })

  } catch (error) {
    console.error('Get user error:', error)
    
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'You do not have permission to view your profile' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Failed to get user data' },
      { status: 500 }
    )
  }
}
