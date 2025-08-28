import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, changePassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const result = await changePassword(user.id, currentPassword, newPassword)

    return NextResponse.json({
      success: true,
      message: result.message
    })

  } catch (error) {
    console.error('Change password error:', error)
    
    let errorMessage = 'Failed to change password'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.message === 'Current password is incorrect') {
        errorMessage = 'Current password is incorrect'
        statusCode = 400
      } else if (error.message === 'User not found') {
        errorMessage = 'User not found'
        statusCode = 404
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}