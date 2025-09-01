import { NextRequest, NextResponse } from 'next/server'
import { advancedEmailService } from '@/lib/advanced-email-service'

export async function POST(request: NextRequest) {
  try {
    const { from, to, subject, html, text, scheduledAt } = await request.json()

    if (!from || !to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: from, to, subject' },
        { status: 400 }
      )
    }

    const result = await advancedEmailService.sendEmail({
      from, to, subject, html, text, scheduledAt
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}