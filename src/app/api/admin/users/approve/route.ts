import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = requireAdmin(request)
    const body = await request.json()
    const { userId, approved } = body

    if (!userId || approved === undefined) {
      return NextResponse.json(
        { error: 'User ID and approval status are required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id: userId }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update user approval status
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        isApproved: approved
      },
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

    return NextResponse.json({
      message: `User ${approved ? 'approved' : 'unapproved'} successfully`,
      user: updatedUser
    })
  } catch (error) {
    console.error('Error updating user approval:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to update user approval' },
      { status: 500 }
    )
  }
}