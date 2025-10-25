import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatDeviceInfo, formatLocationInfo } from '@/lib/device-tracking'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const entityType = searchParams.get('entityType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const skip = (page - 1) * limit
    
    // Build where clause
    const where: any = {}
    
    if (userId) {
      where.userId = userId
    }
    
    if (action) {
      where.action = action
    }
    
    if (entityType) {
      where.entityType = entityType
    }
    
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }
    
    // Get activities with user information
    const [activities, total] = await Promise.all([
      db.userActivity.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      db.userActivity.count({ where })
    ])
    
    // Format activities for display
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      user: activity.user,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      entityName: activity.entityName,
      oldValues: activity.oldValues,
      newValues: activity.newValues,
      ipAddress: activity.ipAddress,
      deviceInfo: formatDeviceInfo({
        deviceName: activity.deviceName ?? undefined,
        deviceType: activity.deviceType ?? undefined,
        browser: activity.browser ?? undefined,
        os: activity.os ?? undefined,
        userAgent: activity.userAgent ?? undefined
      }),
      locationInfo: formatLocationInfo(activity.location as any),
      rawLocation: activity.location,
      metadata: activity.metadata,
      timestamp: activity.createdAt,
      timeAgo: getTimeAgo(activity.createdAt)
    }))
    
    return NextResponse.json({
      success: true,
      data: {
        activities: formattedActivities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
    
  } catch (error) {
    console.error('Error fetching user activities:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch user activities' },
      { status: 500 }
    )
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hours ago`
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) {
    return `${diffInDays} days ago`
  }
  
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths} months ago`
  }
  
  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears} years ago`
}