import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

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
    
    if (error instanceof Error && error.message === 'No token provided') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get user data' },
      { status: 500 }
    )
  }
}