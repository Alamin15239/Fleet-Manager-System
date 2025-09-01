import { NextRequest, NextResponse } from 'next/server'
import { advancedEmailService } from '@/lib/advanced-email-service'

export async function POST(request: NextRequest) {
  try {
    const { emails } = await request.json()

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails array is required' },
        { status: 400 }
      )
    }

    const result = await advancedEmailService.sendBatchEmails(emails)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}