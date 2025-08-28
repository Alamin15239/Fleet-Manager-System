import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = requireAdmin(request)
    
    // Get all users for debugging
    const allUsers = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Get only pending users (not approved and not deleted)
    const pendingUsers = allUsers.filter(u => !u.isApproved && !u.isDeleted)

    return NextResponse.json({
      debug: {
        totalUsers: allUsers.length,
        pendingUsersCount: pendingUsers.length,
        allUsers: allUsers
      },
      pendingUsers: pendingUsers
    })
  } catch (error) {
    console.error('Error fetching pending users:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to fetch pending users' },
      { status: 500 }
    )
  }
}