import { Resend, type CreateBatchOptions, type CreateEmailOptions } from 'resend'

interface EmailData {
  id: string
  from: string
  to: string[]
  subject: string
  html?: string
  text?: string
  created_at: string
  last_event: string
}

interface BatchEmailRequest {
  from: string
  to: string
  subject: string
  html?: string
  text?: string
}

export class AdvancedEmailService {
  private resend: Resend | null = null

  private getResend(): Resend {
    if (this.resend) return this.resend

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required')
    }

    this.resend = new Resend(apiKey)
    return this.resend
  }

  // Send single email
  async sendEmail(params: {
    from: string
    to: string | string[]
    subject: string
    html?: string
    text?: string
    scheduledAt?: string
  }) {
    try {
      const content = params.html !== undefined
        ? { html: params.html, ...(params.text !== undefined ? { text: params.text } : {}) }
        : params.text !== undefined ? { text: params.text } : null
      if (!content) throw new Error('Email HTML or text content is required')

      const emailOptions: CreateEmailOptions = {
        from: params.from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        ...content,
        ...(params.scheduledAt !== undefined ? { scheduledAt: params.scheduledAt } : {})
      }
      const { data, error } = await this.getResend().emails.send(emailOptions)

      if (error) {
        throw new Error(`Failed to send email: ${error.message}`)
      }

      return { success: true, data }
    } catch (error) {
      console.error('Send email error:', error)
      throw error
    }
  }

  // Send batch emails
  async sendBatchEmails(emails: BatchEmailRequest[]) {
    try {
      const payload: CreateBatchOptions = emails.map(email => {
        const content = email.html !== undefined
          ? { html: email.html, ...(email.text !== undefined ? { text: email.text } : {}) }
          : email.text !== undefined ? { text: email.text } : null
        if (!content) throw new Error('Each email needs HTML or text content')
        return { from: email.from, to: email.to, subject: email.subject, ...content }
      })
      const { data, error } = await this.getResend().batch.send(payload)

      if (error) {
        throw new Error(`Failed to send batch emails: ${error.message}`)
      }

      return { success: true, data }
    } catch (error) {
      console.error('Send batch emails error:', error)
      throw error
    }
  }

  // Retrieve email by ID
  async getEmail(emailId: string): Promise<EmailData> {
    try {
      const { data, error } = await this.getResend().emails.get(emailId)

      if (error) {
        throw new Error(`Failed to retrieve email: ${error.message}`)
      }

      return data as EmailData
    } catch (error) {
      console.error('Get email error:', error)
      throw error
    }
  }

  // Update scheduled email
  async updateEmail(emailId: string, params: { scheduledAt?: string }) {
    try {
      if (!params.scheduledAt) throw new Error('A new scheduled time is required')
      const { data, error } = await this.getResend().emails.update({ id: emailId, scheduledAt: params.scheduledAt })

      if (error) {
        throw new Error(`Failed to update email: ${error.message}`)
      }

      return { success: true, data }
    } catch (error) {
      console.error('Update email error:', error)
      throw error
    }
  }

  // Cancel scheduled email
  async cancelEmail(emailId: string) {
    try {
      const { data, error } = await this.getResend().emails.cancel(emailId)

      if (error) {
        throw new Error(`Failed to cancel email: ${error.message}`)
      }

      return { success: true, data }
    } catch (error) {
      console.error('Cancel email error:', error)
      throw error
    }
  }

  // Fleet Manager specific methods
  async sendMaintenanceAlert(params: {
    to: string
    truckId: string
    maintenanceType: string
    dueDate: string
    urgency: 'low' | 'medium' | 'high' | 'critical'
  }) {
    const urgencyColors = {
      low: '#28a745',
      medium: '#ffc107', 
      high: '#fd7e14',
      critical: '#dc3545'
    }

    return this.sendEmail({
      from: process.env.EMAIL_FROM || 'Fleet Manager <noreply@resend.dev>',
      to: params.to,
      subject: `🚨 Maintenance Alert - ${params.maintenanceType} Due`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${urgencyColors[params.urgency]}; color: white; padding: 20px; text-align: center;">
            <h2>🚛 Maintenance Alert</h2>
          </div>
          <div style="padding: 20px;">
            <p><strong>Truck ID:</strong> ${params.truckId}</p>
            <p><strong>Maintenance Type:</strong> ${params.maintenanceType}</p>
            <p><strong>Due Date:</strong> ${params.dueDate}</p>
            <p><strong>Urgency:</strong> <span style="color: ${urgencyColors[params.urgency]}; font-weight: bold;">${params.urgency.toUpperCase()}</span></p>
          </div>
        </div>
      `
    })
  }

  async sendBulkMaintenanceReminders(reminders: Array<{
    email: string
    truckId: string
    maintenanceType: string
    dueDate: string
  }>) {
    const emails = reminders.map(reminder => ({
      from: process.env.EMAIL_FROM || 'Fleet Manager <noreply@resend.dev>',
      to: reminder.email,
      subject: `🔧 Maintenance Reminder - ${reminder.truckId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #667eea; color: white; padding: 20px; text-align: center;">
            <h2>🚛 Maintenance Reminder</h2>
          </div>
          <div style="padding: 20px;">
            <p>Your truck <strong>${reminder.truckId}</strong> needs <strong>${reminder.maintenanceType}</strong></p>
            <p><strong>Due Date:</strong> ${reminder.dueDate}</p>
            <p>Please schedule this maintenance as soon as possible.</p>
          </div>
        </div>
      `
    }))

    return this.sendBatchEmails(emails)
  }

  async scheduleMaintenanceReminder(params: {
    to: string
    truckId: string
    maintenanceType: string
    scheduledAt: string
  }) {
    return this.sendEmail({
      from: process.env.EMAIL_FROM || 'Fleet Manager <noreply@resend.dev>',
      to: params.to,
      subject: `📅 Scheduled Maintenance Reminder - ${params.truckId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #28a745; color: white; padding: 20px; text-align: center;">
            <h2>📅 Scheduled Maintenance</h2>
          </div>
          <div style="padding: 20px;">
            <p>This is a scheduled reminder for:</p>
            <p><strong>Truck:</strong> ${params.truckId}</p>
            <p><strong>Maintenance:</strong> ${params.maintenanceType}</p>
            <p>Please ensure this maintenance is completed on time.</p>
          </div>
        </div>
      `,
      scheduledAt: params.scheduledAt
    })
  }
}

export const advancedEmailService = new AdvancedEmailService()
