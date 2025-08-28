import { NextRequest, NextResponse } from 'next/server'
import { resendEmailService } from '@/lib/resend-email'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    const success = await resendEmailService.verifyEmailToken(token)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Email verified successfully'
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    )
  }
}