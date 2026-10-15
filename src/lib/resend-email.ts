import { Resend } from 'resend'
import { SHA256 } from 'crypto-js'
import { randomBytes, randomInt } from 'crypto'
import { db } from '@/lib/db'

interface EmailConfig {
  from: string
  apiKey: string
}

class ResendEmailService {
  private config: EmailConfig
  private resend: Resend | null = null

  constructor() {
    this.config = {
      from: process.env.EMAIL_FROM || 'Fleet Manager <onboarding@resend.dev>',
      apiKey: process.env.RESEND_API_KEY || ''
    }

    if (!this.config.apiKey) {
      console.warn('⚠️  RESEND_API_KEY not found. Email functionality will be limited.')
    } else {
      console.log('✅ Resend email service initialized')
    }
  }

  private getResend(): Resend {
    if (this.resend) return this.resend
    if (!this.config.apiKey) {
      throw new Error('Email delivery is not configured')
    }

    this.resend = new Resend(this.config.apiKey)
    return this.resend
  }

  // Generate a secure 6-digit OTP
  generateOTP(): string {
    return randomInt(100000, 1000000).toString()
  }

  // Generate email verification token
  generateEmailToken(): string {
    return randomBytes(32).toString('hex')
  }

  // Hash OTP for storage
  hashOTP(otp: string): string {
    return SHA256(otp).toString()
  }

  // Verify OTP
  verifyOTP(otp: string, hashedOTP: string): boolean {
    const hashedInput = SHA256(otp).toString()
    return hashedInput === hashedOTP
  }

  // Check if OTP is expired
  isOTPExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt
  }

  // Check if user can request new OTP (rate limiting)
  canRequestOTP(lastRequest: Date | null): boolean {
    if (!lastRequest) return true
    
    const cooldownPeriod = 60 * 1000 // 60 seconds cooldown
    const timeSinceLastRequest = new Date().getTime() - new Date(lastRequest).getTime()
    
    return timeSinceLastRequest >= cooldownPeriod
  }

  // Send OTP email using Resend
  async sendOTPEmail(email: string, otp: string, name?: string): Promise<void> {
    try {
      if (!this.config.apiKey) {
        throw new Error('Email delivery is not configured')
      }

      const { data, error } = await this.getResend().emails.send({
        from: this.config.from,
        to: email,
        subject: '🔐 Your OTP for Fleet Manager Login',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Fleet Manager - OTP</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">🚛 Fleet Manager</div>
                <div style="opacity: 0.9; font-size: 16px;">Maintenance Management System</div>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <h2 style="color: #333; margin-top: 0; font-size: 24px;">Your One-Time Password (OTP)</h2>
                <p style="color: #666; line-height: 1.6; font-size: 16px;">
                  ${name ? `Hello ${name},` : 'Hello,'}
                </p>
                <p style="color: #666; line-height: 1.6; font-size: 16px;">
                  Your OTP for accessing the Fleet Manager system is:
                </p>
                
                <!-- OTP Display -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                  <div style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                    ${otp}
                  </div>
                  <div style="color: rgba(255, 255, 255, 0.9); font-size: 14px; margin-top: 10px;">
                    ⏰ Valid for 10 minutes only
                  </div>
                </div>
                
                <!-- Security Notice -->
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <div style="color: #856404; font-size: 15px; font-weight: bold; margin-bottom: 8px;">
                    🔒 Security Notice:
                  </div>
                  <div style="color: #856404; font-size: 14px; line-height: 1.5;">
                    • Never share your OTP with anyone<br>
                    • Our team will never ask for your OTP<br>
                    • This OTP can only be used once
                  </div>
                </div>
                
                <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 0;">
                  If you didn't request this OTP, please ignore this email or contact our support team immediately.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="background: #2c3e50; color: white; text-align: center; padding: 25px; font-size: 13px;">
                <div style="margin-bottom: 8px;">© 2024 Fleet Manager. All rights reserved.</div>
                <div style="opacity: 0.8; font-size: 12px;">
                  This is an automated message. Please do not reply to this email.
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      })

      if (error) {
        console.error('OTP provider rejected email delivery')
        throw new Error('Failed to send OTP email')
      }

    } catch (error) {
      console.error('OTP email delivery failed')
      throw new Error('OTP email delivery failed')
    }
  }

  // Send email verification email using Resend
  async sendVerificationEmail(email: string, verificationToken: string, name?: string): Promise<void> {
    try {
      const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`

      if (!this.config.apiKey) {
        throw new Error('Verification email service is not configured')
      }

      const { data, error } = await this.getResend().emails.send({
        from: this.config.from,
        to: email,
        subject: '📧 Verify Your Email Address - Fleet Manager',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Fleet Manager - Email Verification</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">🚛 Fleet Manager</div>
                <div style="opacity: 0.9; font-size: 16px;">Maintenance Management System</div>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <h2 style="color: #333; margin-top: 0; font-size: 24px;">Verify Your Email Address</h2>
                <p style="color: #666; line-height: 1.6; font-size: 16px;">
                  ${name ? `Hello ${name},` : 'Hello,'}
                </p>
                <p style="color: #666; line-height: 1.6; font-size: 16px;">
                  Thank you for registering with Fleet Manager! Please verify your email address to activate your account.
                </p>
                
                <!-- Verification Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                    ✅ Verify Email Address
                  </a>
                </div>
                
                <!-- Alternative Link -->
                <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <div style="color: #495057; font-size: 14px; font-weight: bold; margin-bottom: 8px;">
                    🔗 Or copy and paste this link:
                  </div>
                  <div style="color: #6c757d; line-height: 1.5; font-size: 12px; word-break: break-all; font-family: 'Courier New', monospace;">
                    ${verificationLink}
                  </div>
                </div>
                
                <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 0;">
                  If you didn't create an account with Fleet Manager, please ignore this email.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="background: #2c3e50; color: white; text-align: center; padding: 25px; font-size: 13px;">
                <div style="margin-bottom: 8px;">© 2024 Fleet Manager. All rights reserved.</div>
                <div style="opacity: 0.8; font-size: 12px;">
                  This is an automated message. Please do not reply to this email.
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      })

      if (error) {
        console.error('❌ Resend API error:', error)
        throw new Error('Failed to send verification email')
      }

      console.log(`✅ Verification email sent successfully to ${email}`)
      
    } catch (error) {
      console.error('Failed to send verification email')
      throw new Error('Verification email could not be delivered')
    }
  }

  // Send password reset email using Resend
  async sendPasswordResetEmail(email: string, resetLink: string, name?: string): Promise<void> {
    try {
      if (!this.config.apiKey) {
        throw new Error('Password reset email service is not configured')
      }

      const { data, error } = await this.getResend().emails.send({
        from: this.config.from,
        to: email,
        subject: '🔐 Reset Your Password - Fleet Manager',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Fleet Manager - Password Reset</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px;">🚛 Fleet Manager</div>
                <div style="opacity: 0.9; font-size: 16px;">Maintenance Management System</div>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <h2 style="color: #333; margin-top: 0; font-size: 24px;">Reset Your Password</h2>
                <p style="color: #666; line-height: 1.6; font-size: 16px;">
                  ${name ? `Hello ${name},` : 'Hello,'}
                </p>
                <p style="color: #666; line-height: 1.6; font-size: 16px;">
                  We received a request to reset your password for your Fleet Manager account. Click the button below to create a new password.
                </p>
                
                <!-- Reset Button -->
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                    🔐 Reset Password
                  </a>
                </div>
                
                <!-- Alternative Link -->
                <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <div style="color: #495057; font-size: 14px; font-weight: bold; margin-bottom: 8px;">
                    🔗 Or copy and paste this link:
                  </div>
                  <div style="color: #6c757d; line-height: 1.5; font-size: 12px; word-break: break-all; font-family: 'Courier New', monospace;">
                    ${resetLink}
                  </div>
                </div>
                
                <!-- Security Notice -->
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
                  <div style="color: #856404; font-size: 15px; font-weight: bold; margin-bottom: 8px;">
                    🔒 Security Notice:
                  </div>
                  <div style="color: #856404; font-size: 14px; line-height: 1.5;">
                    • This password reset link will expire in <strong>1 hour</strong><br>
                    • If you didn't request this, please ignore this email<br>
                    • Never share your password with anyone
                  </div>
                </div>
                
                <p style="color: #666; line-height: 1.6; font-size: 16px; margin-bottom: 0;">
                  If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="background: #2c3e50; color: white; text-align: center; padding: 25px; font-size: 13px;">
                <div style="margin-bottom: 8px;">© 2024 Fleet Manager. All rights reserved.</div>
                <div style="opacity: 0.8; font-size: 12px;">
                  This is an automated message. Please do not reply to this email.
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      })

      if (error) {
        console.error('❌ Resend API error:', error)
        throw new Error('Failed to send password reset email')
      }

      console.log(`✅ Password reset email sent successfully to ${email}`)
      
    } catch (error) {
      console.error('Failed to send password reset email')
      throw new Error('Password reset email could not be delivered')
    }
  }

  // Store OTP in database
  async storeOTP(userId: string, otp: string): Promise<void> {
    const hashedOTP = this.hashOTP(otp)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry

    await db.user.update({
      where: { id: userId },
      data: {
        otpCode: hashedOTP,
        otpExpires: expiresAt,
        lastOtpRequest: new Date()
      }
    })
  }

  // Store email verification token
  async storeEmailToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours expiry

    await db.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: expiresAt
      }
    })
  }

  // Verify OTP for a user
  async verifyUserOTP(userId: string, otp: string): Promise<boolean> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId }
      })

      if (!user || !user.otpCode || !user.otpExpires) {
        return false
      }

      if (this.isOTPExpired(user.otpExpires)) {
        return false
      }

      return this.verifyOTP(otp, user.otpCode)
    } catch (error) {
      console.error('Error verifying OTP:', error)
      return false
    }
  }

  // Verify email with token
  async verifyEmailToken(token: string): Promise<boolean> {
    try {
      const user = await db.user.findFirst({
        where: {
          emailVerificationToken: token,
          emailVerificationExpires: {
            gt: new Date()
          }
        }
      })

      if (!user) {
        return false
      }

      // Mark email as verified
      await db.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null
        }
      })

      return true
    } catch (error) {
      console.error('Error verifying email token:', error)
      return false
    }
  }

  // Send OTP for login
  async sendLoginOTP(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await db.user.findUnique({
        where: {
          email: email.toLowerCase(),
          isActive: true,
          isDeleted: false
        }
      })

      if (!user) {
        return { success: false, message: 'Unable to send OTP. Check the account details or try again shortly.' }
      }

      if (!user.isEmailVerified) {
        return { success: false, message: 'Unable to send OTP. Check the account details or try again shortly.' }
      }

      // Check rate limiting
      if (!this.canRequestOTP(user.lastOtpRequest)) {
        return { success: false, message: 'Unable to send OTP. Check the account details or try again shortly.' }
      }

      // Generate and send OTP
      const otp = this.generateOTP()
      await this.storeOTP(user.id, otp)
      await this.sendOTPEmail(email, otp, user.name || undefined)

      return { success: true, message: 'OTP sent successfully' }
    } catch (error) {
      console.error('Unable to complete login OTP request')
      return { success: false, message: 'Failed to send OTP' }
    }
  }

  // Verify OTP for login
  async verifyLoginOTP(email: string, otp: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      const user = await db.user.findUnique({
        where: { 
          email,
          isActive: true,
          isDeleted: false
        }
      })

      if (!user) {
        return { success: false, message: 'User not found' }
      }

      if (!await this.verifyUserOTP(user.id, otp)) {
        return { success: false, message: 'Invalid or expired OTP' }
      }

      // Clear OTP after successful verification
      await db.user.update({
        where: { id: user.id },
        data: {
          otpCode: null,
          otpExpires: null
        }
      })

      return { 
        success: true, 
        message: 'OTP verified successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          isApproved: user.isApproved,
          isEmailVerified: user.isEmailVerified
        }
      }
    } catch (error) {
      console.error('Error verifying login OTP:', error)
      return { success: false, message: 'Failed to verify OTP' }
    }
  }
}

// Export singleton instance
export const resendEmailService = new ResendEmailService()
export default ResendEmailService
