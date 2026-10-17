import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

const privateNoStore = { 'Cache-Control': 'private, no-store, max-age=0' }

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
        { status: 404, headers: privateNoStore }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        ...fullUser,
        organizationId: user.organizationId,
        organizationSlug: user.organizationSlug,
        organizationName: user.organizationName,
        isPrimaryOrganization: user.isPrimaryOrganization
      }
    }, { headers: privateNoStore })

  } catch (error) {
    console.error('Get user error:', error)
    
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: privateNoStore }
      )
    }

    return NextResponse.json({ error: 'Unable to load user profile' }, { status: 503, headers: privateNoStore })
  }
}
