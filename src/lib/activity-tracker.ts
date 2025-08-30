import { db } from '@/lib/db'
import { getTrackingInfo, TrackingInfo } from '@/lib/device-tracking'
import { NextRequest } from 'next/server'

export interface ActivityData {
  userId: string
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  oldValues?: any
  newValues?: any
  metadata?: any
}

export async function trackUserActivity(
  activityData: ActivityData,
  request?: NextRequest
): Promise<void> {
  try {
    let trackingInfo: TrackingInfo | null = null
    
    if (request) {
      trackingInfo = await getTrackingInfo(request)
    }
    
    await db.userActivity.create({
      data: {
        userId: activityData.userId,
        action: activityData.action,
        entityType: activityData.entityType,
        entityId: activityData.entityId,
        entityName: activityData.entityName,
        oldValues: activityData.oldValues ? JSON.parse(JSON.stringify(activityData.oldValues)) : null,
        newValues: activityData.newValues ? JSON.parse(JSON.stringify(activityData.newValues)) : null,
        ipAddress: trackingInfo?.ipAddress || '127.0.0.1',
        userAgent: trackingInfo?.device.userAgent || 'Unknown',
        deviceName: trackingInfo?.device.deviceName,
        deviceType: trackingInfo?.device.deviceType,
        browser: trackingInfo?.device.browser,
        os: trackingInfo?.device.os,
        location: trackingInfo?.location ? JSON.parse(JSON.stringify(trackingInfo.location)) : null,
        metadata: activityData.metadata ? JSON.parse(JSON.stringify(activityData.metadata)) : null
      }
    })
  } catch (error) {
    console.warn('Failed to track user activity:', error)
  }
}

export async function trackAuditLog(
  auditData: {
    action: string
    entityType: string
    entityId: string
    userId: string
    userName?: string
    userEmail?: string
    userRole?: string
    changes?: any
  },
  request?: NextRequest
): Promise<void> {
  try {
    let trackingInfo: TrackingInfo | null = null
    
    if (request) {
      trackingInfo = await getTrackingInfo(request)
    }
    
    await db.auditLog.create({
      data: {
        action: auditData.action,
        entityType: auditData.entityType,
        entityId: auditData.entityId,
        userId: auditData.userId,
        userName: auditData.userName,
        userEmail: auditData.userEmail,
        userRole: auditData.userRole,
        changes: auditData.changes ? JSON.parse(JSON.stringify(auditData.changes)) : null,
        ipAddress: trackingInfo?.ipAddress || '127.0.0.1',
        userAgent: trackingInfo?.device.userAgent || 'Unknown',
        deviceName: trackingInfo?.device.deviceName,
        deviceType: trackingInfo?.device.deviceType,
        browser: trackingInfo?.device.browser,
        os: trackingInfo?.device.os,
        location: trackingInfo?.location ? JSON.parse(JSON.stringify(trackingInfo.location)) : null
      }
    })
  } catch (error) {
    console.warn('Failed to track audit log:', error)
  }
}

// Common activity tracking functions
export const ActivityActions = {
  // Authentication
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET: 'PASSWORD_RESET',
  
  // User Management
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  USER_ACTIVATE: 'USER_ACTIVATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  USER_APPROVE: 'USER_APPROVE',
  
  // Fleet Management
  TRUCK_CREATE: 'TRUCK_CREATE',
  TRUCK_UPDATE: 'TRUCK_UPDATE',
  TRUCK_DELETE: 'TRUCK_DELETE',
  TRUCK_VIEW: 'TRUCK_VIEW',
  
  // Maintenance
  MAINTENANCE_CREATE: 'MAINTENANCE_CREATE',
  MAINTENANCE_UPDATE: 'MAINTENANCE_UPDATE',
  MAINTENANCE_DELETE: 'MAINTENANCE_DELETE',
  MAINTENANCE_VIEW: 'MAINTENANCE_VIEW',
  
  // Tire Management
  TIRE_CREATE: 'TIRE_CREATE',
  TIRE_UPDATE: 'TIRE_UPDATE',
  TIRE_DELETE: 'TIRE_DELETE',
  TIRE_VIEW: 'TIRE_VIEW',
  
  // Reports
  REPORT_GENERATE: 'REPORT_GENERATE',
  REPORT_DOWNLOAD: 'REPORT_DOWNLOAD',
  REPORT_VIEW: 'REPORT_VIEW',
  
  // System
  SETTINGS_UPDATE: 'SETTINGS_UPDATE',
  SYSTEM_ACCESS: 'SYSTEM_ACCESS',
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_IMPORT: 'DATA_IMPORT'
} as const

export const EntityTypes = {
  USER: 'USER',
  TRUCK: 'TRUCK',
  MAINTENANCE: 'MAINTENANCE',
  TIRE: 'TIRE',
  VEHICLE: 'VEHICLE',
  REPORT: 'REPORT',
  SETTINGS: 'SETTINGS',
  SYSTEM: 'SYSTEM'
} as const

// Helper function to track registration
export async function trackRegistration(
  userId: string,
  userEmail: string,
  request?: NextRequest
): Promise<void> {
  await trackUserActivity({
    userId,
    action: ActivityActions.REGISTER,
    entityType: EntityTypes.USER,
    entityId: userId,
    entityName: userEmail,
    metadata: {
      registrationTime: new Date().toISOString(),
      accountStatus: 'pending_approval'
    }
  }, request)
}

// Helper function to track logout
export async function trackLogout(
  userId: string,
  sessionDuration?: number,
  request?: NextRequest
): Promise<void> {
  try {
    // Update login history
    await db.loginHistory.updateMany({
      where: {
        userId,
        isActive: true,
        logoutTime: null
      },
      data: {
        logoutTime: new Date(),
        sessionDuration,
        isActive: false
      }
    })
    
    // Track logout activity
    await trackUserActivity({
      userId,
      action: ActivityActions.LOGOUT,
      entityType: EntityTypes.USER,
      entityId: userId,
      metadata: {
        logoutTime: new Date().toISOString(),
        sessionDuration
      }
    }, request)
  } catch (error) {
    console.warn('Failed to track logout:', error)
  }
}