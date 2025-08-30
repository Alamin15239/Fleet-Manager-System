import { NextRequest, NextResponse } from 'next/server';
import { resendEmailService } from '@/lib/resend-email';
import { db } from '@/lib/db';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { email, otp, isLogin } = await request.json();

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
      if (!user.isActive) {
        return NextResponse.json(
          { error: 'Account is deactivated' },
          { status: 403 }
        );
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
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
          isEmailVerified: updatedUser.isEmailVerified
        },
        message: 'Login successful'
      });
    }

    // Email verification only
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. Please wait for admin approval to access the system.'
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}