import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
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

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // All new users are created as USER role and require admin approval
    const user = await createUser({
      email,
      password,
      name,
      role: 'USER',
      permissions: {}
    })

    // Generate email verification token and send verification email
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    
    // Store verification token
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires
      }
    })
    
    // Send verification email
    try {
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const verificationLink = `https://fleet-manager-system-8v25sihl9-alamins-projects-d8a281b1.vercel.app/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`
        
        await resend.emails.send({
          from: 'Fleet Manager <onboarding@resend.dev>',
          to: email,
          subject: '✅ Verify Your Email - Fleet Manager',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb; text-align: center;">🚛 Fleet Manager</h1>
              <h2 style="color: #1f2937;">Verify Your Email Address</h2>
              <p>Hello ${name || 'User'},</p>
              <p>Thank you for registering with Fleet Manager! Please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">✅ Verify Email</a>
              </div>
              <p><strong>🔗 Or copy and paste this link:</strong><br>
              <a href="${verificationLink}">${verificationLink}</a></p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p><strong>📋 Next Steps:</strong></p>
                <ol>
                  <li>Click the verification link above</li>
                  <li>Wait for admin approval</li>
                  <li>You'll receive another email when approved</li>
                  <li>Then you can log in to Fleet Manager</li>
                </ol>
              </div>
              <p><strong>⏰ This verification link will expire in 24 hours.</strong></p>
              <p>If you didn't create this account, please ignore this email.</p>
            </div>
          `
        })
        console.log('Verification email sent to:', email)
      }
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Don't fail the registration if email fails, just log it
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        isApproved: user.isApproved,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt
      },
      message: 'Account created successfully. Please check your email to verify your account, then wait for admin approval before you can access the system.'
    })

  } catch (error) {
    console.error('Registration error:', error)
    
    let errorMessage = 'Registration failed'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.message === 'User already exists') {
        errorMessage = 'User with this email already exists'
        statusCode = 409
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}