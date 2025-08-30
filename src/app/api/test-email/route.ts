import { NextRequest, NextResponse } from 'next/server'
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

    // Generate test OTP
    const otp = resendEmailService.generateOTP()
    
    // Send test OTP email
    await resendEmailService.sendOTPEmail(email, otp, 'Test User')

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined
    })

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}