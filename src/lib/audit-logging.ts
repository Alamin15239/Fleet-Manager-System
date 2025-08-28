import { db } from '@/lib/db';
import { NextRequest } from 'next/server';

export interface AuditData {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(data: AuditData) {
  try {
    await db.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        userRole: data.userRole,
        changes: data.changes,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw error to avoid disrupting the main operation
  }
}

export async function getAuditLogs(params: {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const { userId, action, entityType, entityId, startDate, endDate, limit = 50, offset = 0 } = params;
  
  const where: any = {};
  
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
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
    db.auditLog.count({ where }),
  ]);

  return { logs, total };
}

export function createChangeRecord(oldData: any, newData: any) {
  const changes: any = {};
  
  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  
  for (const key of allKeys) {
    const oldValue = oldData?.[key];
    const newValue = newData?.[key];
    
    // Skip if values are the same
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      continue;
    }
    
    changes[key] = {
      from: oldValue,
      to: newValue,
    };
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

export async function logEntityChange(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  entityId: string,
  userId: string,
  oldData?: any,
  newData?: any,
  request?: NextRequest
) {
  try {
    // Get user details
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true },
    });

    const changes = action === 'CREATE' 
      ? { created: newData }
      : action === 'DELETE'
      ? { deleted: oldData }
      : createChangeRecord(oldData, newData);

    const ipAddress = request ? getClientIP(request) : undefined;
    const userAgent = request?.headers.get('user-agent') || undefined;

    await logAuditEvent({
      action,
      entityType,
      entityId,
      userId,
      userName: user?.name,
      userEmail: user?.email,
      userRole: user?.role,
      changes,
      ipAddress,
      userAgent,
    });

    // Also log as user activity
    const { logUserActivity } = await import('./activity-tracking');
    await logUserActivity({
      userId,
      action,
      entityType,
      entityId,
      entityName: `${entityType} ${action.toLowerCase()}`,
      oldValues: oldData,
      newValues: newData,
      ipAddress,
      userAgent,
      metadata: { auditLog: true },
    });
  } catch (error) {
    console.error('Failed to log entity change:', error);
    // Don't throw error to avoid disrupting the main operation
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