import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      // Don't reveal if user exists or not
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a reset link has been sent.'
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpires = new Date(Date.now() + 3600000) // 1 hour

    // Update user with reset token
    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires
      }
    })

    console.log(`Reset token for ${email}: ${resetToken}`)
    console.log(`Reset URL: https://fleet-manager-system-5trwqnmbc-alamins-projects-d8a281b1.vercel.app/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`)

    return NextResponse.json({
      success: true,
      message: 'Reset link generated',
      resetToken,
      resetUrl: `https://fleet-manager-system-5trwqnmbc-alamins-projects-d8a281b1.vercel.app/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`
    })

  } catch (error) {
    console.error('Request reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}