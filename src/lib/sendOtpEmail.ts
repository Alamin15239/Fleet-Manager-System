// lib/sendOtpEmail.ts
// This file is deprecated. Use resendEmailService from @/lib/resend-email instead.
import { resendEmailService } from '@/lib/resend-email'

/**
 * @deprecated Use resendEmailService.sendOTPEmail() instead
 */
export async function sendOtpEmail(to: string, otp: string, name?: string) {
  console.warn('⚠️  sendOtpEmail is deprecated. Use resendEmailService.sendOTPEmail() instead.')
  try {
    await resendEmailService.sendOTPEmail(to, otp, name)
    return true
  } catch (error) {
    console.error('❌ Error sending OTP:', error)
    return false
  }
}
