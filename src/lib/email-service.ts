import { Resend } from 'resend'
import { db } from './db'

interface EmailNotification {
  to: string
  subject: string
  html: string
  text?: string
}

export class EmailService {
  private static resend: Resend | null = null

  /**
   * Initialize Resend client
   */
  private static getResend() {
    if (this.resend) return this.resend

    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required')
    }
    
    this.resend = new Resend(process.env.RESEND_API_KEY)
    return this.resend
  }

  /**
   * Send email notification
   */
  static async sendNotification(notification: EmailNotification): Promise<boolean> {
    try {
      const settings = await db.settings.findFirst()
      const notificationSettings = settings?.notifications as any

      if (!notificationSettings?.email) {
        console.log('Email notifications disabled in settings')
        return false
      }

      const resend = this.getResend()
      
      await resend.emails.send({
        from: `${settings?.companyName || 'Fleet Manager'} <noreply@${process.env.RESEND_DOMAIN || 'yourdomain.com'}>`,
        to: notification.to,
        subject: notification.subject,
        text: notification.text,
        html: notification.html
      })

      console.log(`Email sent successfully to ${notification.to}`)
      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  /**
   * Send maintenance notification email
   */
  static async sendMaintenanceNotification(data: {
    type: 'upcoming' | 'overdue'
    truck: any
    message: string
    remainingKm?: number
    overdueKm?: number
  }): Promise<void> {
    try {
      // Get admin users to notify
      const adminUsers = await db.user.findMany({
        where: { 
          role: 'ADMIN', 
          isActive: true,
          isApproved: true 
        }
      })

      const settings = await db.settings.findFirst()
      const companyName = settings?.companyName || 'Fleet Manager'

      for (const user of adminUsers) {
        const emailHtml = this.generateMaintenanceEmailTemplate({
          userName: user.name || user.email,
          companyName,
          type: data.type,
          truck: data.truck,
          message: data.message,
          remainingKm: data.remainingKm,
          overdueKm: data.overdueKm
        })

        await this.sendNotification({
          to: user.email,
          subject: `${data.type === 'upcoming' ? 'Upcoming' : 'Overdue'} Maintenance Alert - ${data.truck.make} ${data.truck.model}`,
          html: emailHtml,
          text: data.message
        })
      }
    } catch (error) {
      console.error('Error sending maintenance notification email:', error)
    }
  }

  /**
   * Generate maintenance email template
   */
  private static generateMaintenanceEmailTemplate(data: {
    userName: string
    companyName: string
    type: 'upcoming' | 'overdue'
    truck: any
    message: string
    remainingKm?: number
    overdueKm?: number
  }): string {
    const isOverdue = data.type === 'overdue'
    const statusColor = isOverdue ? '#dc2626' : '#f59e0b'
    const statusText = isOverdue ? 'OVERDUE' : 'DUE SOON'

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Maintenance Alert</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 24px;">${data.companyName}</h1>
            <p style="margin: 5px 0 0 0; color: #6b7280;">Fleet Maintenance Alert</p>
        </div>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: ${statusColor}; margin-top: 0; display: flex; align-items: center;">
                <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 10px;">${statusText}</span>
                Maintenance Alert
            </h2>
            
            <p>Hello ${data.userName},</p>
            
            <p>${data.message}</p>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #374151;">Vehicle Details:</h3>
                <ul style="margin: 0; padding-left: 20px;">
                    <li><strong>Vehicle:</strong> ${data.truck.make} ${data.truck.model} (${data.truck.year})</li>
                    <li><strong>License Plate:</strong> ${data.truck.licensePlate}</li>
                    <li><strong>VIN:</strong> ${data.truck.vin}</li>
                    <li><strong>Current Mileage:</strong> ${data.truck.currentMileage.toLocaleString()} km</li>
                    ${data.remainingKm ? `<li><strong>Remaining:</strong> ${data.remainingKm} km</li>` : ''}
                    ${data.overdueKm ? `<li><strong>Overdue by:</strong> ${data.overdueKm} km</li>` : ''}
                </ul>
            </div>

            <div style="background: ${isOverdue ? '#fef2f2' : '#fffbeb'}; border: 1px solid ${isOverdue ? '#fecaca' : '#fed7aa'}; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h4 style="margin: 0 0 10px 0; color: ${statusColor};">
                    ${isOverdue ? '⚠️ Immediate Action Required' : '📅 Schedule Maintenance Soon'}
                </h4>
                <p style="margin: 0;">
                    ${isOverdue 
                        ? 'This vehicle is overdue for maintenance. Please schedule service immediately to avoid potential breakdowns and safety issues.'
                        : 'Please schedule maintenance for this vehicle soon to maintain optimal performance and safety.'
                    }
                </p>
            </div>

            <p>Please log into the Fleet Management System to view more details and schedule the required maintenance.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}" 
                   style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Open Fleet Manager
                </a>
            </div>
        </div>

        <div style="text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            <p>This is an automated message from ${data.companyName} Fleet Management System.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </body>
    </html>
    `
  }
}