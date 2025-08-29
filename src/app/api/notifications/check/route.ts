import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notification-service'

export async function POST(request: NextRequest) {
  try {
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

export async function GET(request: NextRequest) {
  try {
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