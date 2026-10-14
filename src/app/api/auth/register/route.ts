import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { trackRegistration } from '@/lib/activity-tracker'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email verification is not configured. Please contact the administrator.' },
        { status: 503 }
      )
    }

    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
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

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // All new users are created as USER role and require admin approval
    const user = await createUser({
      email,
      password,
      name,
      role: 'USER',
      permissions: {}
    })

    // Generate and send OTP for email verification
    const { resendEmailService } = await import('@/lib/resend-email')
    const otp = resendEmailService.generateOTP()
    
    // Store OTP for verification
    await resendEmailService.storeOTP(user.id, otp)
    
    // Send OTP email
    let emailSent = false
    try {
      await resendEmailService.sendOTPEmail(email, otp, name)
      emailSent = true
    } catch (emailError) {
      console.error('Failed to send registration OTP')
    }

    // Track registration activity
    try {
      await trackRegistration(user.id, user.email, request)
    } catch (trackingError) {
      console.warn('Failed to track registration:', trackingError)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        isApproved: user.isApproved,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      },
      message: emailSent
        ? 'Account created successfully. Please check your email for the OTP to verify your account, then wait for admin approval before you can access the system.'
        : 'Account created, but the verification email could not be delivered. Please try requesting a new OTP later or contact the administrator.'
    })

  } catch (error) {
    console.error('Registration error:', error)
    
    let errorMessage = 'Registration failed'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.message === 'User already exists') {
        errorMessage = 'User with this email already exists'
        statusCode = 409
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}
