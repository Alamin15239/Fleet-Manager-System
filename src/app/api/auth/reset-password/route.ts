import { NextRequest, NextResponse } from 'next/server'
import { db, findOrganizationBySlug, withOrganization } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { token, email, password, organizationSlug } = await request.json()

    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const organization = await findOrganizationBySlug(organizationSlug)
    return await withOrganization(organization, async () => {

    // Find user with valid reset token
    const user = await db.user.findFirst({
      where: {
        email: String(email).trim().toLowerCase(),
        resetToken: token,
        resetTokenExpires: {
          gt: new Date()
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Update user password and clear reset token
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    })
    })

  } catch (error) {
    if (error instanceof Error && error.message === 'Organization was not found or is not ready') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
