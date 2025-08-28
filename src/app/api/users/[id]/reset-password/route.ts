import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { resetPassword } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request)

    // Get user email
    const user = await db.user.findUnique({
      where: { 
        id: params.id,
        isDeleted: false,
        isActive: true 
      },
      select: { email: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const result = await resetPassword(user.email)

    return NextResponse.json({
      success: true,
      message: result.message,
      // Only include temp password in development
      ...(process.env.NODE_ENV === 'development' && { tempPassword: result.tempPassword })
    })

  } catch (error) {
    console.error('Error resetting password:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    let errorMessage = 'Failed to reset password'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.message === 'User not found') {
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