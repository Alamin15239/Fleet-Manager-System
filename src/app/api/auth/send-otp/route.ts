import { NextRequest, NextResponse } from 'next/server'
import { resendEmailService } from '@/lib/resend-email'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    console.log('📧 OTP Request for:', email)
    
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

    console.log('✅ Email validation passed')

    // Use the resend email service to send OTP
    console.log('🚀 Calling sendLoginOTP...')
    const result = await resendEmailService.sendLoginOTP(email)
    console.log('📤 SendLoginOTP result:', result)
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      })
    } else {
      console.log('❌ SendLoginOTP failed:', result.message)
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }


  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}