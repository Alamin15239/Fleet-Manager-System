import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

function getAuthorizationError(error: unknown): NextResponse | null {
  const message = error instanceof Error ? error.message : ''
  if (message === 'No token provided' || message === 'Invalid token') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (message === 'Insufficient permissions') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

// Helper function to map notification types to frontend types
function getNotificationType(type: string): 'success' | 'warning' | 'info' {
  switch (type) {
    case 'oil_change':
    case 'upcoming_maintenance':
      return 'warning'
    case 'overdue':
    case 'alert':
      return 'warning'
    case 'system':
      return 'info'
    default:
      return 'info'
  }
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'oil_change', 'upcoming_maintenance', 'overdue'
    const userId = searchParams.get('userId')
    const requestedLimit = Number(searchParams.get('limit'))
    const requestedOffset = Number(searchParams.get('offset'))
    const take = Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 20
    const skip = Number.isInteger(requestedOffset) && requestedOffset > 0
      ? Math.min(requestedOffset, 100000)
      : 0

    let whereClause: any = { OR: [{ userId: user.id }, { userId: null }] }
    
    if (type) {
      whereClause.type = type
    }
    
    if (user.role === 'ADMIN' && userId) {
      whereClause = { userId }
      if (type) whereClause.type = type
    }

    const notifications = await db.notification.findMany({
      where: whereClause,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
        truckId: true,
        truck: {
          select: {
            id: true,
            vin: true,
            make: true,
            model: true,
            licensePlate: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take
    })

    // Format notifications for frontend
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      type: getNotificationType(notification.type),
      title: notification.title,
      message: notification.message,
      time: formatTimeAgo(notification.createdAt),
      createdAt: notification.createdAt.toISOString(),
      read: notification.isRead,
      truckId: notification.truckId,
      truck: notification.truck
    }))

    return NextResponse.json(formattedNotifications)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    const authorizationError = getAuthorizationError(error)
    if (authorizationError) return authorizationError
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const { type, title, message, truckId, userId, metadata } = body

    const notification = await db.notification.create({
      data: {
        type,
        title,
        message,
        truckId,
        userId: user.role === 'ADMIN' && userId ? userId : user.id,
        metadata: metadata || {},
        isRead: false
      },
      include: {
        truck: {
          select: {
            id: true,
            vin: true,
            make: true,
            model: true,
            licensePlate: true
          }
        }
      }
    })

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error('Error creating notification:', error)
    const authorizationError = getAuthorizationError(error)
    if (authorizationError) return authorizationError
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')
    const action = searchParams.get('action')

    if (action === 'markAsRead' && notificationId) {
      const result = await db.notification.updateMany({
        where: {
          id: notificationId,
          OR: [{ userId: user.id }, { userId: null }]
        },
        data: { isRead: true }
      })
      if (result.count === 0) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    if (action === 'markAllAsRead') {
      await db.notification.updateMany({
        where: {
          isRead: false,
          // Global notifications have a shared read flag in the current schema.
          OR: [{ userId: user.id }, { userId: null }]
        },
        data: { isRead: true }
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating notification:', error)
    const authorizationError = getAuthorizationError(error)
    if (authorizationError) return authorizationError
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    )
  }
}
