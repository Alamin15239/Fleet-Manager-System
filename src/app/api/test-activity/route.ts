import { NextResponse } from 'next/server'
import { logUserActivity } from '@/lib/activity-tracking'
import { requireAuth } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)

    // Create sample activities
    const activities = [
      {
        userId: user.id,
        action: 'LOGIN' as const,
        entityType: 'USER_SESSION',
        entityName: 'User Login',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
        metadata: { test: true }
      },
      {
        userId: user.id,
        action: 'VIEW' as const,
        entityType: 'DASHBOARD',
        entityName: 'Dashboard View',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
        metadata: { test: true }
      },
      {
        userId: user.id,
        action: 'CREATE' as const,
        entityType: 'TRUCK',
        entityName: 'Test Truck Creation',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
        metadata: { test: true }
      }
    ]

    for (const activity of activities) {
      await logUserActivity(activity)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Test activities created',
      count: activities.length 
    })
  } catch (error) {
    console.error('Error creating test activities:', error)
    return NextResponse.json({ error: 'Failed to create test activities' }, { status: 500 })
  }
}