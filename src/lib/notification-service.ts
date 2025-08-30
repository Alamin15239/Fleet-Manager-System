import { db } from './db'
import { PredictiveMaintenanceEngine } from './predictive-maintenance'
import { EmailService } from './email-service'

interface NotificationSettings {
  email?: boolean
  upcomingMaintenance?: boolean
  overdueMaintenance?: boolean
  lowStock?: boolean
}

export class NotificationService {
  /**
   * Check and send maintenance notifications based on settings
   */
  static async checkMaintenanceNotifications(): Promise<void> {
    try {
      // Get notification settings
      const settings = await db.settings.findFirst()
      if (!settings?.notifications) return

      const notificationSettings = settings.notifications as NotificationSettings

      // Check upcoming maintenance notifications
      if (notificationSettings.upcomingMaintenance) {
        await this.checkUpcomingMaintenance()
      }

      // Check overdue maintenance notifications
      if (notificationSettings.overdueMaintenance) {
        await this.checkOverdueMaintenance()
      }

      // Check low stock notifications
      if (notificationSettings.lowStock) {
        await this.checkLowStock()
      }

    } catch (error) {
      console.error('Error checking maintenance notifications:', error)
    }
  }

  /**
   * Check for upcoming maintenance based on intervals
   */
  private static async checkUpcomingMaintenance(): Promise<void> {
    const settings = await db.settings.findFirst()
    const intervals = settings?.maintenanceIntervals as any

    if (!intervals) return

    const trucks = await db.truck.findMany({
      where: { status: 'ACTIVE', isDeleted: false },
      include: {
        maintenanceRecords: {
          orderBy: { datePerformed: 'desc' },
          take: 10
        }
      }
    })

    for (const truck of trucks) {
      // Check oil change interval
      if (intervals.oilChange) {
        const lastOilChange = truck.maintenanceRecords.find(
          record => record.serviceType.toLowerCase().includes('oil')
        )
        
        if (lastOilChange) {
          const mileageSinceOilChange = truck.currentMileage - (lastOilChange.currentMileage || 0)
          const remainingMileage = intervals.oilChange - mileageSinceOilChange
          
          if (remainingMileage <= 500 && remainingMileage > 0) {
            await this.createNotification({
              type: 'upcoming_maintenance',
              title: 'Oil Change Due Soon',
              message: `${truck.make} ${truck.model} (${truck.licensePlate}) needs oil change in ${remainingMileage} km`,
              truckId: truck.id
            })
            
            // Send email notification
            await EmailService.sendMaintenanceNotification({
              type: 'upcoming',
              truck,
              message: `${truck.make} ${truck.model} (${truck.licensePlate}) needs oil change in ${remainingMileage} km`,
              remainingKm: remainingMileage
            })
          }
        }
      }

      // Check tire rotation interval
      if (intervals.tireRotation) {
        const lastTireRotation = truck.maintenanceRecords.find(
          record => record.serviceType.toLowerCase().includes('tire') || 
                   record.serviceType.toLowerCase().includes('rotation')
        )
        
        if (lastTireRotation) {
          const mileageSinceTireRotation = truck.currentMileage - (lastTireRotation.currentMileage || 0)
          const remainingMileage = intervals.tireRotation - mileageSinceTireRotation
          
          if (remainingMileage <= 1000 && remainingMileage > 0) {
            await this.createNotification({
              type: 'upcoming_maintenance',
              title: 'Tire Rotation Due Soon',
              message: `${truck.make} ${truck.model} (${truck.licensePlate}) needs tire rotation in ${remainingMileage} km`,
              truckId: truck.id
            })
          }
        }
      }

      // Check brake inspection interval
      if (intervals.brakeInspection) {
        const lastBrakeInspection = truck.maintenanceRecords.find(
          record => record.serviceType.toLowerCase().includes('brake')
        )
        
        if (lastBrakeInspection) {
          const mileageSinceBrakeInspection = truck.currentMileage - (lastBrakeInspection.currentMileage || 0)
          const remainingMileage = intervals.brakeInspection - mileageSinceBrakeInspection
          
          if (remainingMileage <= 1500 && remainingMileage > 0) {
            await this.createNotification({
              type: 'upcoming_maintenance',
              title: 'Brake Inspection Due Soon',
              message: `${truck.make} ${truck.model} (${truck.licensePlate}) needs brake inspection in ${remainingMileage} km`,
              truckId: truck.id
            })
          }
        }
      }
    }
  }

  /**
   * Check for overdue maintenance
   */
  private static async checkOverdueMaintenance(): Promise<void> {
    const settings = await db.settings.findFirst()
    const intervals = settings?.maintenanceIntervals as any

    if (!intervals) return

    const trucks = await db.truck.findMany({
      where: { status: 'ACTIVE', isDeleted: false },
      include: {
        maintenanceRecords: {
          orderBy: { datePerformed: 'desc' },
          take: 10
        }
      }
    })

    for (const truck of trucks) {
      // Check overdue oil change
      if (intervals.oilChange) {
        const lastOilChange = truck.maintenanceRecords.find(
          record => record.serviceType.toLowerCase().includes('oil')
        )
        
        if (lastOilChange) {
          const mileageSinceOilChange = truck.currentMileage - (lastOilChange.currentMileage || 0)
          
          if (mileageSinceOilChange > intervals.oilChange) {
            const overdueMileage = mileageSinceOilChange - intervals.oilChange
            await this.createNotification({
              type: 'overdue',
              title: 'Oil Change Overdue',
              message: `${truck.make} ${truck.model} (${truck.licensePlate}) is ${overdueMileage} km overdue for oil change`,
              truckId: truck.id
            })
            
            // Send email notification
            await EmailService.sendMaintenanceNotification({
              type: 'overdue',
              truck,
              message: `${truck.make} ${truck.model} (${truck.licensePlate}) is ${overdueMileage} km overdue for oil change`,
              overdueKm: overdueMileage
            })
          }
        } else if (truck.currentMileage > intervals.oilChange) {
          // No oil change record found
          await this.createNotification({
            type: 'overdue',
            title: 'Oil Change Required',
            message: `${truck.make} ${truck.model} (${truck.licensePlate}) has no oil change record and is at ${truck.currentMileage} km`,
            truckId: truck.id
          })
        }
      }

      // Check overdue tire rotation
      if (intervals.tireRotation) {
        const lastTireRotation = truck.maintenanceRecords.find(
          record => record.serviceType.toLowerCase().includes('tire') || 
                   record.serviceType.toLowerCase().includes('rotation')
        )
        
        if (lastTireRotation) {
          const mileageSinceTireRotation = truck.currentMileage - (lastTireRotation.currentMileage || 0)
          
          if (mileageSinceTireRotation > intervals.tireRotation) {
            const overdueMileage = mileageSinceTireRotation - intervals.tireRotation
            await this.createNotification({
              type: 'overdue',
              title: 'Tire Rotation Overdue',
              message: `${truck.make} ${truck.model} (${truck.licensePlate}) is ${overdueMileage} km overdue for tire rotation`,
              truckId: truck.id
            })
          }
        }
      }
    }
  }

  /**
   * Check for low stock based on maintenance usage patterns
   */
  private static async checkLowStock(): Promise<void> {
    try {
      // Get recent maintenance records to estimate part usage
      const recentMaintenance = await db.maintenanceRecord.findMany({
        where: {
          datePerformed: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        select: {
          serviceType: true,
          partsCost: true,
          description: true
        }
      })

      // Count usage of common parts
      const partUsage = {
        'Engine Oil': 0,
        'Oil Filter': 0,
        'Brake Pads': 0,
        'Air Filter': 0,
        'Tire': 0
      }

      recentMaintenance.forEach(record => {
        const service = record.serviceType.toLowerCase()
        const description = (record.description || '').toLowerCase()
        
        if (service.includes('oil') || description.includes('oil')) {
          partUsage['Engine Oil']++
          partUsage['Oil Filter']++
        }
        if (service.includes('brake') || description.includes('brake')) {
          partUsage['Brake Pads']++
        }
        if (service.includes('filter') || description.includes('air filter')) {
          partUsage['Air Filter']++
        }
        if (service.includes('tire') || description.includes('tire')) {
          partUsage['Tire']++
        }
      })

      // Estimate current stock based on usage (simulated inventory)
      const estimatedStock = {
        'Engine Oil': Math.max(0, 10 - partUsage['Engine Oil']),
        'Oil Filter': Math.max(0, 8 - partUsage['Oil Filter']),
        'Brake Pads': Math.max(0, 6 - partUsage['Brake Pads']),
        'Air Filter': Math.max(0, 5 - partUsage['Air Filter']),
        'Tire': Math.max(0, 4 - partUsage['Tire'])
      }

      const thresholds = {
        'Engine Oil': 3,
        'Oil Filter': 2,
        'Brake Pads': 2,
        'Air Filter': 2,
        'Tire': 1
      }

      // Check for low stock
      for (const [partName, currentStock] of Object.entries(estimatedStock)) {
        const threshold = thresholds[partName as keyof typeof thresholds]
        
        if (currentStock <= threshold) {
          await this.createNotification({
            type: 'alert',
            title: 'Low Stock Alert',
            message: `${partName} is running low (${currentStock} estimated remaining, threshold: ${threshold}). Used ${partUsage[partName as keyof typeof partUsage]} in last 30 days.`,
            truckId: null
          })
        }
      }
    } catch (error) {
      console.error('Error checking low stock:', error)
    }
  }

  /**
   * Create a notification in the database
   */
  private static async createNotification(data: {
    type: string
    title: string
    message: string
    truckId: string | null
    userId?: string
  }): Promise<void> {
    try {
      // Check if similar notification already exists (prevent spam)
      const existingNotification = await db.notification.findFirst({
        where: {
          type: data.type,
          title: data.title,
          truckId: data.truckId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })

      if (!existingNotification) {
        await db.notification.create({
          data: {
            type: data.type,
            title: data.title,
            message: data.message,
            truckId: data.truckId,
            userId: data.userId,
            isRead: false,
            metadata: {}
          }
        })
        
        console.log(`Notification created: ${data.title}`)
      }
    } catch (error) {
      console.error('Error creating notification:', error)
    }
  }

  /**
   * Send email notification if enabled
   */
  private static async sendEmailNotification(notification: any): Promise<void> {
    const settings = await db.settings.findFirst()
    const notificationSettings = settings?.notifications as NotificationSettings

    if (!notificationSettings?.email) return

    // Email sending logic would go here
    // For now, just log that email would be sent
    console.log(`Email notification would be sent: ${notification.title}`)
  }

  /**
   * Run all notification checks (to be called by cron job or scheduler)
   */
  static async runNotificationChecks(): Promise<void> {
    try {
      console.log('Running notification checks...')
      await this.checkMaintenanceNotifications()
      console.log('Notification checks completed')
    } catch (error) {
      console.error('Error in runNotificationChecks:', error)
      throw error
    }
  }
}