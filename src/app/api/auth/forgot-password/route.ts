import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Resend } from 'resend'
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if user exists and is active
    const user = await db.user.findUnique({
      where: { 
        email: email.toLowerCase()
      }
    })

    // Check if user is active and not deleted
    if (user && (!user.isActive || user.isDeleted)) {
      return NextResponse.json({
        success: true,
        message: 'If your email address is in our database, you will receive a password reset link shortly.'
      })
    }

    // Always return success message even if user doesn't exist (security best practice)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If your email address is in our database, you will receive a password reset link shortly.'
      })
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    // Store reset token in user record
    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetToken,
        resetTokenExpires: resetTokenExpiry
      }
    })

    // Send password reset email
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`
    
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'Fleet Manager <noreply@yourdomain.com>',
          to: email,
          subject: '🔐 Reset Your Password - Fleet Manager',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb; text-align: center;">🚛 Fleet Manager</h1>
              <h2 style="color: #1f2937;">Reset Your Password</h2>
              <p>Hello ${user.name || 'Admin User'},</p>
              <p>We received a request to reset your password for your Fleet Manager account. Click the button below to create a new password.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">🔐 Reset Password</a>
              </div>
              <p><strong>🔗 Or copy and paste this link:</strong><br>
              <a href="${resetLink}">${resetLink}</a></p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p><strong>🔒 Security Notice:</strong></p>
                <ul>
                  <li>This password reset link will expire in 1 hour</li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>Never share your password with anyone</li>
                </ul>
              </div>
              <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
            </div>
          `
        })
      } catch (emailError) {
        console.log('📧 Email sending failed, logging reset link:')
        console.log(`Reset link for ${email}: ${resetLink}`)
      }
    } else {
      console.log('📧 No email service configured, logging reset link:')
      console.log(`Reset link for ${email}: ${resetLink}`)
    }

    return NextResponse.json({
      success: true,
      message: 'If your email address is in our database, you will receive a password reset link shortly.',
      resetToken,
      resetLink
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    )
  }
}