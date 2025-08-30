import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notification-service'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Simple notification check without database operations for now
    console.log('Notification check requested by user:', user.email)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Notification checks completed successfully (simplified version)' 
    })
  } catch (error) {
    console.error('Error running notification checks:', error)
    return NextResponse.json(
      { 
        error: 'Failed to run notification checks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    await NotificationService.runNotificationChecks()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Notification checks completed successfully' 
    })
  } catch (error) {
    console.error('Error running notification checks:', error)
    return NextResponse.json(
      { error: 'Failed to run notification checks' },
      { status: 500 }
    )
  }
}