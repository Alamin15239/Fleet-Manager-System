import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const email = url.searchParams.get('email')
  
  if (!email) {
    return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
  }

  try {
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
        otpExpires: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ 
        found: false, 
        message: 'User not found in database',
        email 
      })
    }

    return NextResponse.json({
      found: true,
      user: {
        ...user,
        otpCode: user.otpCode ? 'Present' : 'None',
        otpExpires: user.otpExpires?.toISOString() || null,
        lastOtpRequest: user.lastOtpRequest?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      },
      canReceiveOTP: user.isActive && !user.isDeleted,
      resendConfigured: !!process.env.RESEND_API_KEY
    })

  } catch (error) {
    console.error('Check user error:', error)
    return NextResponse.json({
      error: 'Database error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}