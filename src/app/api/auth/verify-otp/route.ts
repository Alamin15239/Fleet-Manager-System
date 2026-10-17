import { NextRequest, NextResponse } from 'next/server';
import { resendEmailService } from '@/lib/resend-email';
import { db, findOrganizationBySlug, withOrganization } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { logUserLogin } from '@/lib/activity-tracking';

export async function POST(request: NextRequest) {
  try {
    const { email, otp, isLogin, organizationSlug } = await request.json();

    const organization = await findOrganizationBySlug(organizationSlug)
    return await withOrganization(organization, async () => {

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify OTP
    const isValidOTP = await resendEmailService.verifyUserOTP(user.id, otp);

    if (!isValidOTP) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Update user and clear OTP
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        otpCode: null,
        otpExpires: null
      }
    });

    // If this is a login attempt, generate token and return user data
    if (isLogin) {
      if (!updatedUser.isActive) {
        return NextResponse.json(
          { error: 'Account has been disabled by administrator' },
          { status: 403 }
        );
      }

      if (!updatedUser.isApproved) {
        return NextResponse.json(
          { error: 'Your account is pending admin approval' },
          { status: 403 }
        );
      }

      try {
        await logUserLogin(updatedUser.id, request)
      } catch (error) {
        console.warn('Failed to log OTP login activity')
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: updatedUser.id, 
          email: updatedUser.email, 
          role: updatedUser.role,
          organizationId: organization.id,
          organizationSlug: organization.slug,
          organizationName: organization.name,
          isPrimaryOrganization: organization.isPrimary
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      return NextResponse.json({
        success: true,
        token,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          isApproved: updatedUser.isApproved,
          isEmailVerified: updatedUser.isEmailVerified,
          profileImage: updatedUser.profileImage,
          permissions: updatedUser.permissions,
          phone: updatedUser.phone,
          department: updatedUser.department,
          title: updatedUser.title,
          bio: updatedUser.bio,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
          organizationId: organization.id,
          organizationSlug: organization.slug,
          organizationName: organization.name,
          isPrimaryOrganization: organization.isPrimary
        },
        message: 'Login successful'
      });
    }

    // Email verification only
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. Please wait for admin approval to access the system.'
    });
    })

  } catch (error) {
    console.error('OTP verification error:', error);
    if (error instanceof Error && error.message === 'Organization was not found or is not ready') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
