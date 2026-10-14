import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailVerificationService } from '@/lib/email-verification'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Verification email is not configured. Please contact the administrator.' },
        { status: 503 }
      )
    }

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

    // Find user by email
    const user = await db.user.findUnique({
      where: { 
        email,
        isActive: true,
        isDeleted: false 
      }
    })

    const genericMessage = 'If an unverified account exists, a verification request has been received.'
    if (!user) {
      return NextResponse.json({
        success: true,
        message: genericMessage
      })
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: genericMessage
      })
    }

    // Check if user can request new verification (rate limiting)
    if (!emailVerificationService.canRequestOTP(user.lastOtpRequest)) {
      return NextResponse.json({ success: true, message: genericMessage })
    }

    // Generate new verification token
    const verificationToken = emailVerificationService.generateEmailToken()
    
    // Store the new token
    await emailVerificationService.storeEmailToken(user.id, verificationToken)

    // Send verification email
    try {
      await emailVerificationService.sendVerificationEmail(email, verificationToken, user.name || undefined)
    } catch (emailError) {
      console.error('Failed to send verification email')
    }

    return NextResponse.json({
      success: true,
      message: genericMessage
    })

  } catch (error) {
    console.error('Resend verification error:', error)
    
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}
