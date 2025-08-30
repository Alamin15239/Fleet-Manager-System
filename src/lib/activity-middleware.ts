import { NextRequest } from 'next/server'
import { trackUserActivity, ActivityActions, EntityTypes } from '@/lib/activity-tracker'
import { verifyToken } from '@/lib/auth'

export async function trackAPIActivity(
  request: NextRequest,
  action: string,
  entityType: string,
  entityId?: string,
  entityName?: string,
  oldValues?: any,
  newValues?: any,
  metadata?: any
) {
  try {
    // Get user from token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return // No auth, skip tracking
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      return // Invalid token, skip tracking
    }

    await trackUserActivity({
      userId: decoded.id,
      action,
      entityType,
      entityId,
      entityName,
      oldValues,
      newValues,
      metadata: {
        ...metadata,
        apiEndpoint: request.url,
        method: request.method,
        timestamp: new Date().toISOString()
      }
    }, request)
  } catch (error) {
    console.warn('Failed to track API activity:', error)
  }
}

// Helper functions for common API activities
export const trackTruckActivity = {
  create: (request: NextRequest, truckData: any) =>
    trackAPIActivity(request, ActivityActions.TRUCK_CREATE, EntityTypes.TRUCK, undefined, `${truckData.make} ${truckData.model} (${truckData.licensePlate})`, undefined, truckData),
  
  update: (request: NextRequest, truckId: string, oldData: any, newData: any) =>
    trackAPIActivity(request, ActivityActions.TRUCK_UPDATE, EntityTypes.TRUCK, truckId, `${newData.make || oldData.make} ${newData.model || oldData.model}`, oldData, newData),
  
  delete: (request: NextRequest, truckId: string, truckData: any) =>
    trackAPIActivity(request, ActivityActions.TRUCK_DELETE, EntityTypes.TRUCK, truckId, `${truckData.make} ${truckData.model}`, truckData),
  
  view: (request: NextRequest, truckId: string, truckData: any) =>
    trackAPIActivity(request, ActivityActions.TRUCK_VIEW, EntityTypes.TRUCK, truckId, `${truckData.make} ${truckData.model}`)
}

export const trackMaintenanceActivity = {
  create: (request: NextRequest, maintenanceData: any) =>
    trackAPIActivity(request, ActivityActions.MAINTENANCE_CREATE, EntityTypes.MAINTENANCE, undefined, maintenanceData.serviceType, undefined, maintenanceData),
  
  update: (request: NextRequest, maintenanceId: string, oldData: any, newData: any) =>
    trackAPIActivity(request, ActivityActions.MAINTENANCE_UPDATE, EntityTypes.MAINTENANCE, maintenanceId, newData.serviceType || oldData.serviceType, oldData, newData),
  
  delete: (request: NextRequest, maintenanceId: string, maintenanceData: any) =>
    trackAPIActivity(request, ActivityActions.MAINTENANCE_DELETE, EntityTypes.MAINTENANCE, maintenanceId, maintenanceData.serviceType, maintenanceData)
}

export const trackTireActivity = {
  create: (request: NextRequest, tireData: any) =>
    trackAPIActivity(request, ActivityActions.TIRE_CREATE, EntityTypes.TIRE, undefined, `${tireData.manufacturer} ${tireData.tireSize}`, undefined, tireData),
  
  update: (request: NextRequest, tireId: string, oldData: any, newData: any) =>
    trackAPIActivity(request, ActivityActions.TIRE_UPDATE, EntityTypes.TIRE, tireId, `${newData.manufacturer || oldData.manufacturer} ${newData.tireSize || oldData.tireSize}`, oldData, newData),
  
  delete: (request: NextRequest, tireId: string, tireData: any) =>
    trackAPIActivity(request, ActivityActions.TIRE_DELETE, EntityTypes.TIRE, tireId, `${tireData.manufacturer} ${tireData.tireSize}`, tireData)
}

export const trackUserActivity = {
  create: (request: NextRequest, userData: any) =>
    trackAPIActivity(request, ActivityActions.USER_CREATE, EntityTypes.USER, undefined, userData.email, undefined, { email: userData.email, name: userData.name, role: userData.role }),
  
  update: (request: NextRequest, userId: string, oldData: any, newData: any) =>
    trackAPIActivity(request, ActivityActions.USER_UPDATE, EntityTypes.USER, userId, newData.email || oldData.email, oldData, newData),
  
  delete: (request: NextRequest, userId: string, userData: any) =>
    trackAPIActivity(request, ActivityActions.USER_DELETE, EntityTypes.USER, userId, userData.email, userData),
  
  activate: (request: NextRequest, userId: string, userData: any) =>
    trackAPIActivity(request, ActivityActions.USER_ACTIVATE, EntityTypes.USER, userId, userData.email, { isActive: false }, { isActive: true }),
  
  deactivate: (request: NextRequest, userId: string, userData: any) =>
    trackAPIActivity(request, ActivityActions.USER_DEACTIVATE, EntityTypes.USER, userId, userData.email, { isActive: true }, { isActive: false }),
  
  approve: (request: NextRequest, userId: string, userData: any) =>
    trackAPIActivity(request, ActivityActions.USER_APPROVE, EntityTypes.USER, userId, userData.email, { isApproved: false }, { isApproved: true })
}

export const trackReportActivity = {
  generate: (request: NextRequest, reportType: string, filters: any) =>
    trackAPIActivity(request, ActivityActions.REPORT_GENERATE, EntityTypes.REPORT, undefined, reportType, undefined, undefined, { reportType, filters }),
  
  download: (request: NextRequest, reportType: string, format: string) =>
    trackAPIActivity(request, ActivityActions.REPORT_DOWNLOAD, EntityTypes.REPORT, undefined, `${reportType} (${format})`, undefined, undefined, { reportType, format })
}