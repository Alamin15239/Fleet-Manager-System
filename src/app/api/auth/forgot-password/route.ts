import { NextRequest, NextResponse } from 'next/server'
import { db, findOrganizationBySlug, withOrganization } from '@/lib/db'
import { resendEmailService } from '@/lib/resend-email'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Password reset email is not configured. Please contact the administrator.' },
        { status: 503 }
      )
    }

    const { email, organizationSlug } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const organization = await findOrganizationBySlug(organizationSlug)
    return await withOrganization(organization, async () => {

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
        message: 'If an account exists, a reset request has been received.'
      })
    }

    // Always return success message even if user doesn't exist (security best practice)
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a reset request has been received.'
      })
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    // Store reset token in user record
    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
        resetTokenExpires: resetTokenExpiry
      }
    })

    // Build the reset URL on the canonical production app domain. Keep the
    // organization context so multi-tenant users return to the correct workspace.
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://fleetmaintenance.site').trim()
    const resetUrl = new URL('/reset-password', appBaseUrl)
    resetUrl.searchParams.set('token', resetToken)
    resetUrl.searchParams.set('email', user.email)
    if (typeof organizationSlug === 'string' && organizationSlug.trim()) {
      resetUrl.searchParams.set('org', organizationSlug.trim())
    }
    const resetLink = resetUrl.toString()

    // Use the shared Resend service and sender configuration.
    try {
      await resendEmailService.sendPasswordResetEmail(user.email, resetLink, user.name || undefined)
    } catch (emailError) {
      // Keep the anti-enumeration response, but invalidate the unusable reset token.
      await db.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpires: null }
      })
      console.error('Password reset email delivery failed; reset token invalidated')
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a reset request has been received.'
    })
    })

  } catch (error) {
    if (error instanceof Error && error.message === 'Organization was not found or is not ready') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Forgot password error:', error)
    
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    )
  }
}
