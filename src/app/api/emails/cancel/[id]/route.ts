import { NextRequest, NextResponse } from 'next/server'
import { advancedEmailService } from '@/lib/advanced-email-service'

export async function DELETE(
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

    const result = await advancedEmailService.cancelEmail(emailId)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}