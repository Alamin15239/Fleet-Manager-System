import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailVerificationService } from '@/lib/email-verification'

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

    // Find user by email
    const user = await db.user.findUnique({
      where: { 
        email,
        isActive: true,
        isDeleted: false 
      }
    })

    if (!user) {
      // Always return success for security (don't reveal if email exists)
      return NextResponse.json({
        success: true,
        message: 'If your email address is in our database, you will receive a verification email shortly.'
      })
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Your email is already verified.'
      })
    }

    // Check if user can request new verification (rate limiting)
    if (!emailVerificationService.canRequestOTP(user.lastOtpRequest)) {
      return NextResponse.json(
        { error: 'Please wait 60 seconds before requesting another verification email.' },
        { status: 429 }
      )
    }

    // Generate new verification token
    const verificationToken = emailVerificationService.generateEmailToken()
    
    // Store the new token
    await emailVerificationService.storeEmailToken(user.id, verificationToken)

    // Send verification email
    try {
      await emailVerificationService.sendVerificationEmail(email, verificationToken, user.name || undefined)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent successfully.'
    })

  } catch (error) {
    console.error('Resend verification error:', error)
    
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    )
  }
}