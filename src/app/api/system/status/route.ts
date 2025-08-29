import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { existsSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    const checks = {
      authentication: { status: 'error', message: 'Not checked' },
      database: { status: 'error', message: 'Not checked' },
      fileStorage: { status: 'error', message: 'Not checked' },
      reportGeneration: { status: 'error', message: 'Not checked' }
    };

    // Check database connection
    try {
      await db.$queryRaw`SELECT 1`;
      const userCount = await db.user.count();
      checks.database = { 
        status: 'operational', 
        message: `${userCount} users in database` 
      };
    } catch (error) {
      checks.database = { status: 'error', message: 'Database connection failed' };
    }

    // Check file storage
    try {
      const uploadsDir = join(process.cwd(), 'public', 'uploads');
      if (existsSync(uploadsDir)) {
        checks.fileStorage = { 
          status: 'operational', 
          message: 'Upload directory accessible' 
        };
      } else {
        checks.fileStorage = { status: 'warning', message: 'Upload directory not found' };
      }
    } catch (error) {
      checks.fileStorage = { status: 'error', message: 'File storage check failed' };
    }

    // Check authentication by verifying JWT secret and active users
    try {
      if (process.env.JWT_SECRET) {
        const activeUsers = await db.user.count({ where: { isActive: true } });
        checks.authentication = { 
          status: 'operational', 
          message: `${activeUsers} active users` 
        };
      } else {
        checks.authentication = { status: 'error', message: 'JWT secret not configured' };
      }
    } catch (error) {
      checks.authentication = { status: 'error', message: 'Authentication check failed' };
    }

    // Check report generation by counting recent reports
    try {
      const recentReports = await db.document.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });
      checks.reportGeneration = { 
        status: 'operational', 
        message: `${recentReports} reports generated today` 
      };
    } catch (error) {
      checks.reportGeneration = { status: 'warning', message: 'Report generation check failed' };
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks
    });

  } catch (error) {
    console.error('System status check failed:', error);
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'System status check failed'
    }, { status: 500 });
  }
}