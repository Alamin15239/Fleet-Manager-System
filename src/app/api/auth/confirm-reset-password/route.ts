import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json()

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Token, email, and password are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Find user with the given email and valid reset token
    const user = await db.user.findUnique({
      where: { 
        email,
        isActive: true,
        isDeleted: false 
      },
      select: {
        id: true,
        email: true,
        emailVerificationToken: true,
        emailVerificationExpires: true,
        password: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if token matches and is not expired
    if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      )
    }

    if (!user.emailVerificationExpires || new Date() > user.emailVerificationExpires) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      )
    }

    // Check if new password is different from old password
    const isSamePassword = await bcrypt.compare(password, user.password)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from the current password' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await hashPassword(password)

    // Update user password and clear reset token
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        emailVerificationToken: null,
        emailVerificationExpires: null
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    })

  } catch (error) {
    console.error('Password reset confirmation error:', error)
    
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}