import { track } from '@vercel/analytics';

export const analytics = {
  // Fleet Management Events
  trackTruckAdded: (truckData: { make: string; model: string; year: number }) => {
    track('truck_added', {
      make: truckData.make,
      model: truckData.model,
      year: truckData.year.toString()
    });
  },

  trackMaintenanceScheduled: (maintenanceData: { serviceType: string; cost: number }) => {
    track('maintenance_scheduled', {
      service_type: maintenanceData.serviceType,
      cost_range: maintenanceData.cost > 500 ? 'high' : maintenanceData.cost > 200 ? 'medium' : 'low'
    });
  },

  trackTireAdded: (tireData: { manufacturer: string; origin: string; quantity: number }) => {
    track('tire_added', {
      manufacturer: tireData.manufacturer,
      origin: tireData.origin,
      quantity: tireData.quantity.toString()
    });
  },

  trackReportGenerated: (reportType: string) => {
    track('report_generated', {
      report_type: reportType
    });
  },

  trackUserLogin: (userRole: string) => {
    track('user_login', {
      role: userRole
    });
  },

  trackDashboardView: () => {
    track('dashboard_viewed');
  },

  trackEmailSent: (emailType: string) => {
    track('email_sent', {
      email_type: emailType
    });
  }
};