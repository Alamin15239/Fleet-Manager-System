import { db } from '@/lib/db';
import { NextRequest } from 'next/server';

export interface ActivityData {
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'EXPORT' | 'IMPORT';
  entityType: string;
  entityId?: string;
  entityName?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export async function logUserActivity(data: ActivityData) {
  try {
    await db.userActivity.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        entityName: data.entityName,
        oldValues: data.oldValues,
        newValues: data.newValues,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      },
    });
  } catch (error) {
    console.error('Failed to log user activity:', error);
    // Don't throw error to avoid disrupting the main operation
  }
}

export async function logUserLogin(userId: string, request: NextRequest) {
  try {
    const ipAddress = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    
    // Create login history record
    const loginHistory = await db.loginHistory.create({
      data: {
        userId,
        loginTime: new Date(),
        ipAddress,
        userAgent,
        isActive: true,
      },
    });

    // Log activity
    await logUserActivity({
      userId,
      action: 'LOGIN',
      entityType: 'USER_SESSION',
      entityName: 'User Login',
      ipAddress,
      userAgent,
      metadata: { loginHistoryId: loginHistory.id },
    });

    return loginHistory.id;
  } catch (error) {
    console.error('Failed to log user login:', error);
    throw error;
  }
}

export async function logUserLogout(userId: string, loginHistoryId?: string) {
  try {
    const logoutTime = new Date();
    
    if (loginHistoryId) {
      // Update login history
      const loginHistory = await db.loginHistory.findUnique({
        where: { id: loginHistoryId },
      });

      if (loginHistory) {
        const sessionDuration = Math.floor(
          (logoutTime.getTime() - loginHistory.loginTime.getTime()) / 1000
        );

        await db.loginHistory.update({
          where: { id: loginHistoryId },
          data: {
            logoutTime,
            sessionDuration,
            isActive: false,
          },
        });
      }
    }

    // Log activity
    await logUserActivity({
      userId,
      action: 'LOGOUT',
      entityType: 'USER_SESSION',
      entityName: 'User Logout',
      metadata: { loginHistoryId, logoutTime },
    });
  } catch (error) {
    console.error('Failed to log user logout:', error);
    throw error;
  }
}

function getClientIP(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfIP) {
    return cfIP;
  }
  
  // Fallback to remote address
  return '127.0.0.1';
}

export async function getUserActivities(params: {
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const { userId, action, entityType, startDate, endDate, limit = 50, offset = 0 } = params;
  
  const where: any = {};
  
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [activities, total] = await Promise.all([
    db.userActivity.findMany({
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
      take: limit,
      skip: offset,
    }),
    db.userActivity.count({ where }),
  ]);

  return { activities, total };
}

export async function getLoginHistory(params: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { userId, startDate, endDate, isActive, limit = 50, offset = 0 } = params;
  
  const where: any = {};
  
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }
  if (isActive !== undefined) where.isActive = isActive;

  const [history, total] = await Promise.all([
    db.loginHistory.findMany({
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
      take: limit,
      skip: offset,
    }),
    db.loginHistory.count({ where }),
  ]);

  return { history, total };
}