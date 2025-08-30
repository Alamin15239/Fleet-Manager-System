import { NextRequest, NextResponse } from 'next/server';
import { resendEmailService } from '@/lib/resend-email';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
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

    if (user.isEmailVerified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    // Check rate limiting
    if (!resendEmailService.canRequestOTP(user.lastOtpRequest)) {
      return NextResponse.json(
        { error: 'Please wait 60 seconds before requesting another OTP' },
        { status: 429 }
      );
    }

    // Generate and send new OTP
    const otp = resendEmailService.generateOTP();
    await resendEmailService.storeOTP(user.id, otp);
    await resendEmailService.sendOTPEmail(email, otp, user.name || undefined);

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to resend OTP' },
      { status: 500 }
    );
  }
}