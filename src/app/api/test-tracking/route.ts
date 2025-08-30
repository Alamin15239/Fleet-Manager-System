import { NextRequest, NextResponse } from 'next/server'
import { trackUserActivity, ActivityActions, EntityTypes } from '@/lib/activity-tracker'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Test tracking functionality
    await trackUserActivity({
      userId: user.id,
      action: ActivityActions.SYSTEM_ACCESS,
      entityType: EntityTypes.SYSTEM,
      entityName: 'Test Tracking Endpoint',
      metadata: {
        testData: 'This is a test of the tracking system',
        timestamp: new Date().toISOString()
      }
    }, request)
    
    return NextResponse.json({
      success: true,
      message: 'Activity tracked successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
    
  } catch (error) {
    console.error('Test tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to test tracking' },
      { status: 500 }
    )
  }
}