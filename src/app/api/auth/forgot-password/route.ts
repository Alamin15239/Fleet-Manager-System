import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resendEmailService } from '@/lib/resend-email'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
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

    // Check if user exists and is active
    const user = await db.user.findUnique({
      where: { 
        email,
        isActive: true,
        isDeleted: false 
      }
    })

    // Always return success message even if user doesn't exist (security best practice)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If your email address is in our database, you will receive a password reset link shortly.'
      })
    }

    // Generate password reset token
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    // Store reset token in user record
    await db.user.update({
      where: { id: user.id },
      data: {
        otpCode: resetToken, // Using otpCode field for reset token
        otpExpires: resetTokenExpiry
      }
    })

    // Send password reset email
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`
    await resendEmailService.sendPasswordResetEmail(email, resetLink, user.name)

    return NextResponse.json({
      success: true,
      message: 'If your email address is in our database, you will receive a password reset link shortly.',
      // Only include reset token in development
      ...(process.env.NODE_ENV === 'development' && { 
        resetToken,
        resetLink
      })
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    )
  }
}