import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { resendEmailService } from '@/lib/resend-email'
import { createUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, action } = await request.json()

    if (action === 'signup') {
      console.log('=== TESTING SIGNUP FLOW ===')
      
      // Delete existing user if exists (for testing)
      await db.user.deleteMany({ where: { email } })
      
      // Create user
      const user = await createUser({
        email,
        password,
        name,
        role: 'USER'
      })
      
      console.log('User created:', user.id)
      
      // Generate and send OTP
      const otp = resendEmailService.generateOTP()
      await resendEmailService.storeOTP(user.id, otp)
      await resendEmailService.sendOTPEmail(email, otp, name)
      
      return NextResponse.json({
        success: true,
        message: 'User created and OTP sent',
        otp, // For testing only
        userId: user.id
      })
    }
    
    if (action === 'verify') {
      console.log('=== TESTING OTP VERIFICATION ===')
      
      const { otp } = await request.json()
      const user = await db.user.findUnique({ where: { email } })
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      const isValid = await resendEmailService.verifyUserOTP(user.id, otp)
      
      if (isValid) {
        await db.user.update({
          where: { id: user.id },
          data: { isEmailVerified: true, otpCode: null, otpExpires: null }
        })
        
        return NextResponse.json({
          success: true,
          message: 'Email verified successfully'
        })
      } else {
        return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 })
      }
    }
    
    if (action === 'login-otp') {
      console.log('=== TESTING LOGIN OTP ===')
      
      const user = await db.user.findUnique({ where: { email } })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      const otp = resendEmailService.generateOTP()
      await resendEmailService.storeOTP(user.id, otp)
      await resendEmailService.sendOTPEmail(email, otp, user.name)
      
      return NextResponse.json({
        success: true,
        message: 'Login OTP sent',
        otp // For testing only
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Test flow error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}