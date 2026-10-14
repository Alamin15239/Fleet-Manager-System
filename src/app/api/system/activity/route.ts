import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    // Settings are available to regular users too, so only expose their own activity here.
    const recentActivities = await db.userActivity.findMany({
      where: { userId: user.id },
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
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    return NextResponse.json({
      error: unauthorized ? 'Authentication required' : 'Failed to fetch system activity'
    }, { status: unauthorized ? 401 : 503 });
  }
}
