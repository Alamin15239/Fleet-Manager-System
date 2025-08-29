import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get recent activities from the database
    const recentActivities = await db.userActivity.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    const activities = recentActivities.map(activity => ({
      id: activity.id,
      description: `${activity.action} ${activity.entityType}`,
      timestamp: activity.createdAt,
      user: activity.user?.name || activity.user?.email || 'Unknown User'
    }));

    const response = NextResponse.json({
      activities,
      timestamp: new Date().toISOString()
    });
    
    // Prevent caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error) {
    console.error('Error fetching system activity:', error);
    return NextResponse.json({
      error: 'Failed to fetch system activity'
    }, { status: 500 });
  }
}