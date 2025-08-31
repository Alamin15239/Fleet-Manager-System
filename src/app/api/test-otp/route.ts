import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resendEmailService } from '@/lib/resend-email'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const email = url.searchParams.get('email')
  
  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
  }
  
  return await testOTP(email)
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    return await testOTP(email)
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}

async function testOTP(email: string) {
  try {

    console.log('=== OTP Test Debug ===')
    console.log('Email:', email)
    
    // Check user in database
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        isDeleted: true,
        lastOtpRequest: true,
        otpCode: true,
        otpExpires: true
      }
    })

    console.log('User found:', user)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Test OTP generation and sending
    const otp = resendEmailService.generateOTP()
    console.log('Generated OTP:', otp)

    // Test rate limiting
    const canRequest = resendEmailService.canRequestOTP(user.lastOtpRequest)
    console.log('Can request OTP:', canRequest)

    if (!canRequest) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    // Store OTP
    await resendEmailService.storeOTP(user.id, otp)
    console.log('OTP stored in database')

    // Send OTP email
    await resendEmailService.sendOTPEmail(email, otp, user.name || undefined)
    console.log('OTP email sent')

    return NextResponse.json({
      success: true,
      message: 'OTP test completed',
      debug: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          isApproved: user.isApproved,
          isEmailVerified: user.isEmailVerified,
          isDeleted: user.isDeleted
        },
        otp,
        canRequestOTP: canRequest,
        hasResendKey: !!process.env.RESEND_API_KEY
      }
    })

  } catch (error) {
    console.error('OTP test error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}