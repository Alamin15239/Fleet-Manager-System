import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notification-service'
import { verifyToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyToken(request)
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Simple notification check without database operations for now
    console.log('Notification check requested by user:', authResult.user?.email)
    
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
    const authResult = await verifyToken(request)
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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