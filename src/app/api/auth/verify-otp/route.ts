import { NextRequest, NextResponse } from 'next/server'
import { resendEmailService } from '@/lib/resend-email'
import { generateToken } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
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

    const result = await resendEmailService.verifyLoginOTP(email, otp)

    if (result.success && result.user) {
      // Check if user is approved
      if (!result.user.isApproved) {
        return NextResponse.json(
          { error: 'Your account is pending admin approval' },
          { status: 403 }
        )
      }

      // Check if user is email verified
      if (!result.user.isEmailVerified) {
        return NextResponse.json(
          { error: 'Please verify your email address before logging in' },
          { status: 403 }
        )
      }

      // Generate JWT token
      const token = generateToken({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        isActive: result.user.isActive,
        isApproved: result.user.isApproved,
        isEmailVerified: result.user.isEmailVerified
      })

      // Log login activity
      await db.loginHistory.create({
        data: {
          userId: result.user.id,
          loginTime: new Date(),
          ipAddress: '127.0.0.1', // In real app, get from request
          userAgent: 'Mozilla/5.0' // In real app, get from request
        }
      })

      // Create response with token in cookie
      const response = NextResponse.json({
        success: true,
        user: result.user,
        token: token,
        message: 'Login successful'
      })

      // Set HTTP-only cookie with token
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      })

      return response
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}