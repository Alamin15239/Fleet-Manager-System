import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const reportSchema = z.object({
  type: z.enum(['activities', 'login-history', 'user-summary']),
  userIds: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);

    const body = await request.json();
    const validatedData = reportSchema.parse(body);
    
    const startDate = validatedData.startDate ? new Date(validatedData.startDate) : undefined;
    const endDate = validatedData.endDate ? new Date(validatedData.endDate) : undefined;

    let reportData;
    
    switch (validatedData.type) {
      case 'activities':
        reportData = await generateActivityReport(validatedData.userIds, startDate, endDate);
        break;
      case 'login-history':
        reportData = await generateLoginHistoryReport(validatedData.userIds, startDate, endDate);
        break;
      case 'user-summary':
        reportData = await generateUserSummaryReport(validatedData.userIds, startDate, endDate);
        break;
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    if (validatedData.format === 'csv') {
      const csv = convertToCSV(reportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${validatedData.type}-report.csv"`,
        },
      });
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

async function generateActivityReport(userIds?: string[], startDate?: Date, endDate?: Date) {
  const where: any = {};
  
  if (userIds && userIds.length > 0) {
    where.userId = { in: userIds };
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const activities = await db.userActivity.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    type: 'activities',
    generatedAt: new Date(),
    totalRecords: activities.length,
    data: activities,
  };
}

async function generateLoginHistoryReport(userIds?: string[], startDate?: Date, endDate?: Date) {
  const where: any = {};
  
  if (userIds && userIds.length > 0) {
    where.userId = { in: userIds };
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const history = await db.loginHistory.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { loginTime: 'desc' },
  });

  return {
    type: 'login-history',
    generatedAt: new Date(),
    totalRecords: history.length,
    data: history,
  };
}

async function generateUserSummaryReport(userIds?: string[], startDate?: Date, endDate?: Date) {
  const userWhere: any = {};
  if (userIds && userIds.length > 0) {
    userWhere.id = { in: userIds };
  }

  const users = await db.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      isActive: true,
    },
  });

  const userSummaries = await Promise.all(
    users.map(async (user) => {
      const activityWhere: any = { userId: user.id };
      const loginWhere: any = { userId: user.id };
      
      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.gte = startDate;
        if (endDate) dateFilter.lte = endDate;
        activityWhere.createdAt = dateFilter;
        loginWhere.loginTime = dateFilter;
      }

      const [activities, loginHistory] = await Promise.all([
        db.userActivity.findMany({
          where: activityWhere,
          select: { action: true, entityType: true, createdAt: true },
        }),
        db.loginHistory.findMany({
          where: loginWhere,
          select: { loginTime: true, logoutTime: true, sessionDuration: true },
        }),
      ]);

      const actionCounts = activities.reduce((acc, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalSessionTime = loginHistory
        .filter(h => h.sessionDuration)
        .reduce((sum, h) => sum + (h.sessionDuration || 0), 0);

      return {
        user,
        totalActivities: activities.length,
        actionCounts,
        totalLogins: loginHistory.length,
        totalSessionTime,
        averageSessionTime: loginHistory.length > 0 ? totalSessionTime / loginHistory.length : 0,
        lastActivity: activities[0]?.createdAt,
        lastLogin: loginHistory[0]?.loginTime,
      };
    })
  );

  return {
    type: 'user-summary',
    generatedAt: new Date(),
    totalUsers: users.length,
    data: userSummaries,
  };
}

function convertToCSV(data: any): string {
  if (!data || !data.data || !Array.isArray(data.data)) {
    return 'No data available';
  }

  const headers = Object.keys(data.data[0] || {});
  const csvHeaders = headers.join(',');
  
  const csvRows = data.data.map((row: any) => {
    return headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [csvHeaders, ...csvRows].join('\n');
}