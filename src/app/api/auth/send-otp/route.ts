import { NextRequest, NextResponse } from 'next/server'
import { resendEmailService } from '@/lib/resend-email'
import { db } from '@/lib/db'

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

    // Check if user exists (allow unverified users to receive OTP)
    const user = await db.user.findUnique({
      where: { 
        email,
        isDeleted: false
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if user is disabled by admin
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account has been disabled by administrator' },
        { status: 403 }
      )
    }

    // Check if user can request OTP (rate limiting)
    if (!resendEmailService.canRequestOTP(user.lastOtpRequest)) {
      return NextResponse.json(
        { error: 'Please wait before requesting another OTP' },
        { status: 429 }
      )
    }

    // Generate OTP
    const otp = resendEmailService.generateOTP()

    // Store OTP in database
    await resendEmailService.storeOTP(user.id, otp)

    // Send OTP email
    await resendEmailService.sendOTPEmail(email, otp, user.name)

    // In development mode without RESEND_API_KEY, return OTP for testing
    const isDevelopment = process.env.NODE_ENV !== 'production'
    const hasResendKey = !!process.env.RESEND_API_KEY
    
    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      ...(isDevelopment && !hasResendKey && { otp }) // Include OTP in dev mode
    })

  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}