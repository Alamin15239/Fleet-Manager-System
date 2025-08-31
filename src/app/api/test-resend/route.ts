import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    console.log('=== RESEND TEST ===')
    console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Present' : 'Missing')
    console.log('EMAIL_FROM:', process.env.EMAIL_FROM)
    console.log('Target email:', email)

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        error: 'RESEND_API_KEY not configured',
        config: {
          apiKey: 'Missing',
          emailFrom: process.env.EMAIL_FROM
        }
      }, { status: 500 })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Fleet Manager <delivered@resend.dev>',
      to: email,
      subject: 'Test Email from Fleet Manager',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify Resend configuration.</p>
        <p>If you received this, Resend is working correctly!</p>
        <p>Time: ${new Date().toISOString()}</p>
      `
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      }, { status: 500 })
    }

    console.log('Email sent successfully:', data)
    
    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      data,
      config: {
        from: process.env.EMAIL_FROM,
        to: email
      }
    })

  } catch (error) {
    console.error('Test resend error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}