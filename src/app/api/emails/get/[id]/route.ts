import { NextRequest, NextResponse } from 'next/server'
import { advancedEmailService } from '@/lib/advanced-email-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const emailId = params.id

    if (!emailId) {
      return NextResponse.json(
        { error: 'Email ID is required' },
        { status: 400 }
      )
    }

    const email = await advancedEmailService.getEmail(emailId)
    return NextResponse.json({ success: true, data: email })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}