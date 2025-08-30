import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Test database connection
    await db.$connect();
    
    // Test basic query
    const userCount = await db.user.count();
    
    // Test if activity tables exist
    let activityCount = 0;
    let loginCount = 0;
    
    try {
      activityCount = await db.userActivity.count();
    } catch (error) {
      console.warn('UserActivity table not accessible:', error);
    }
    
    try {
      loginCount = await db.loginHistory.count();
    } catch (error) {
      console.warn('LoginHistory table not accessible:', error);
    }
    
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      tables: {
        users: userCount,
        userActivities: activityCount,
        loginHistory: loginCount
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Database health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 });
  } finally {
    await db.$disconnect();
  }
}