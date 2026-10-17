import { NextRequest, NextResponse } from 'next/server'
import { resendEmailService } from '@/lib/resend-email'
import { findOrganizationBySlug, withOrganization } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { email, organizationSlug } = await request.json()
    
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

    const organization = await findOrganizationBySlug(organizationSlug)
    const result = await withOrganization(organization, () => resendEmailService.sendLoginOTP(email))
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      })
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }


  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'Organization was not found or is not ready') {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    console.error('Failed to process OTP request')
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
