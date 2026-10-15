import { db } from './db'
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
  static async checkMaintenanceNotifications(): Promise<{ status: 'completed' | 'disabled'; warnings: string[] }> {
    const settings = await db.settings.findFirst()
    if (!settings?.notifications) return { status: 'disabled', warnings: ['Notification preferences are not configured.'] }

    const notificationSettings = settings.notifications as NotificationSettings
    if (notificationSettings.upcomingMaintenance) {
      await this.checkUpcomingMaintenance()
      await this.checkUpcomingTrailerMaintenance()
      await this.checkWorkshopJobCards('upcoming')
    }
    if (notificationSettings.overdueMaintenance) {
      await this.checkOverdueMaintenance()
      await this.checkOverdueTrailerMaintenance()
      await this.checkWorkshopJobCards('overdue')
    }

    const warnings = notificationSettings.lowStock
      ? ['Low-stock alerts were skipped because spare-parts inventory levels are not stored in the database.']
      : []
    return { status: 'completed', warnings }
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
          where: { isDeleted: false, status: 'COMPLETED' },
          orderBy: { datePerformed: 'desc' }
        }
      }
    })

    for (const truck of trucks) {
      const now = new Date()
      const dueSoonLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const latestRecordsByService = new Map<string, typeof truck.maintenanceRecords[number]>()
      for (const record of truck.maintenanceRecords) {
        const serviceKey = record.serviceType.trim().toLowerCase()
        if (!latestRecordsByService.has(serviceKey)) latestRecordsByService.set(serviceKey, record)
      }
      for (const record of latestRecordsByService.values()) {
        if (record.nextServiceDue && record.nextServiceDue >= now && record.nextServiceDue <= dueSoonLimit) {
          await this.createNotification({
            type: 'upcoming_maintenance',
            title: `${record.serviceType} Due Soon`,
            message: `${truck.make} ${truck.model} (${truck.licensePlate}) is scheduled for ${record.serviceType} on ${record.nextServiceDue.toLocaleDateString()}.`,
            truckId: truck.id
          })
        }
      }

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

  private static async checkUpcomingTrailerMaintenance(): Promise<void> {
    const now = new Date()
    const dueSoonLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const trailers = await db.trailer.findMany({
      where: { status: 'ACTIVE', isDeleted: false },
      include: {
        trailerMaintenanceRecords: {
          where: { isDeleted: false, status: 'COMPLETED' },
          orderBy: { datePerformed: 'desc' }
        }
      }
    })

    for (const trailer of trailers) {
      const latestByService = new Map<string, typeof trailer.trailerMaintenanceRecords[number]>()
      for (const record of trailer.trailerMaintenanceRecords) {
        const serviceKey = record.serviceType.trim().toLowerCase()
        if (!latestByService.has(serviceKey)) latestByService.set(serviceKey, record)
      }
      const dueDates = [
        ...(trailer.nextInspection ? [{ label: 'inspection', date: trailer.nextInspection }] : []),
        ...Array.from(latestByService.values())
          .filter(record => record.nextServiceDue)
          .map(record => ({ label: record.serviceType, date: record.nextServiceDue! }))
      ]
      for (const due of dueDates) {
        if (due.date >= now && due.date <= dueSoonLimit) {
          const message = `Trailer ${trailer.number} is scheduled for ${due.label} on ${due.date.toLocaleDateString()}.`
          await this.createNotification({
            type: 'upcoming_maintenance',
            title: `Trailer ${trailer.number} ${due.label} Due Soon`,
            message,
            truckId: null,
            emailSubject: `Upcoming maintenance - Trailer ${trailer.number}`
          })
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
          where: { isDeleted: false, status: 'COMPLETED' },
          orderBy: { datePerformed: 'desc' }
        }
      }
    })

    for (const truck of trucks) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const latestRecordsByService = new Map<string, typeof truck.maintenanceRecords[number]>()
      for (const record of truck.maintenanceRecords) {
        const serviceKey = record.serviceType.trim().toLowerCase()
        if (!latestRecordsByService.has(serviceKey)) latestRecordsByService.set(serviceKey, record)
      }
      for (const record of latestRecordsByService.values()) {
        if (record.nextServiceDue && record.nextServiceDue < today) {
          await this.createNotification({
            type: 'overdue',
            title: `${record.serviceType} Overdue`,
            message: `${truck.make} ${truck.model} (${truck.licensePlate}) was due for ${record.serviceType} on ${record.nextServiceDue.toLocaleDateString()}.`,
            truckId: truck.id
          })
        }
      }

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

  private static async checkOverdueTrailerMaintenance(): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const trailers = await db.trailer.findMany({
      where: { status: 'ACTIVE', isDeleted: false },
      include: {
        trailerMaintenanceRecords: {
          where: { isDeleted: false, status: 'COMPLETED' },
          orderBy: { datePerformed: 'desc' }
        }
      }
    })

    for (const trailer of trailers) {
      const latestByService = new Map<string, typeof trailer.trailerMaintenanceRecords[number]>()
      for (const record of trailer.trailerMaintenanceRecords) {
        const serviceKey = record.serviceType.trim().toLowerCase()
        if (!latestByService.has(serviceKey)) latestByService.set(serviceKey, record)
      }
      const dueDates = [
        ...(trailer.nextInspection ? [{ label: 'inspection', date: trailer.nextInspection }] : []),
        ...Array.from(latestByService.values())
          .filter(record => record.nextServiceDue)
          .map(record => ({ label: record.serviceType, date: record.nextServiceDue! }))
      ]
      for (const due of dueDates) {
        if (due.date < today) {
          const message = `Trailer ${trailer.number} was due for ${due.label} on ${due.date.toLocaleDateString()}.`
          await this.createNotification({
            type: 'overdue',
            title: `Trailer ${trailer.number} ${due.label} Overdue`,
            message,
            truckId: null,
            emailSubject: `Overdue maintenance - Trailer ${trailer.number}`
          })
        }
      }
    }
  }

  private static async checkWorkshopJobCards(timing: 'upcoming' | 'overdue'): Promise<void> {
    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const dueSoonLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const cards = await db.workshopJobCard.findMany({
      where: {
        status: { not: 'CANCELLED' },
        OR: [{ nextServiceDate: { not: null } }, { nextServiceOdometer: { not: null } }]
      },
      select: {
        id: true,
        jobNumber: true,
        truckId: true,
        trailerId: true,
        serviceType: true,
        nextServiceDate: true,
        nextServiceOdometer: true,
        truck: { select: { make: true, model: true, licensePlate: true, currentMileage: true } },
        trailer: { select: { number: true } }
      },
      orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }]
    })

    // A newer card for the same vehicle and service replaces its older next-service schedule.
    const latestCards = new Map<string, typeof cards[number]>()
    for (const card of cards) {
      const vehicleId = card.truckId || card.trailerId
      if (!vehicleId) continue
      const serviceKey = `${vehicleId}:${card.serviceType.trim().toLowerCase()}`
      if (!latestCards.has(serviceKey)) latestCards.set(serviceKey, card)
    }

    for (const card of latestCards.values()) {
      const remainingKm = card.nextServiceOdometer != null && card.truck
        ? card.nextServiceOdometer - card.truck.currentMileage
        : null
      const dateOverdue = Boolean(card.nextServiceDate && card.nextServiceDate < today)
      const mileageOverdue = remainingKm !== null && remainingKm < 0
      const dateUpcoming = Boolean(card.nextServiceDate && card.nextServiceDate >= today && card.nextServiceDate <= dueSoonLimit)
      const mileageUpcoming = remainingKm !== null && remainingKm >= 0 && remainingKm <= 500
      const shouldNotify = timing === 'overdue'
        ? dateOverdue || mileageOverdue
        : !dateOverdue && !mileageOverdue && (dateUpcoming || mileageUpcoming)
      if (!shouldNotify) continue

      const vehicle = card.truck
        ? `${card.truck.make} ${card.truck.model} (${card.truck.licensePlate})`
        : `Trailer ${card.trailer?.number || ''}`.trim()
      const dueDetails = [
        card.nextServiceDate ? `date ${card.nextServiceDate.toLocaleDateString()}` : null,
        remainingKm !== null ? `${Math.abs(remainingKm)} km ${remainingKm < 0 ? 'overdue' : 'remaining'}` : null
      ].filter(Boolean).join('; ')
      const title = `${card.truckId ? '' : `${vehicle} `}${card.serviceType} ${timing === 'overdue' ? 'Overdue' : 'Due Soon'}`
      const message = `${vehicle} — ${card.serviceType} (${dueDetails || 'scheduled service'}). Job card ${card.jobNumber}.`
      await this.createNotification({
        type: timing === 'overdue' ? 'overdue' : 'upcoming_maintenance',
        title,
        message,
        truckId: card.truckId,
        emailSubject: card.trailerId ? `${timing === 'overdue' ? 'Overdue' : 'Upcoming'} maintenance - Trailer ${card.trailer?.number || ''}` : undefined
      })
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
    emailSubject?: string
  }): Promise<boolean> {
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

      if (existingNotification) return false
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
      if (data.truckId) {
        const truck = await db.truck.findUnique({ where: { id: data.truckId } })
        if (truck) {
          await EmailService.sendMaintenanceNotification({
            type: data.type === 'overdue' ? 'overdue' : 'upcoming',
            truck,
            message: data.message
          })
        }
      } else if (data.emailSubject) {
        await EmailService.sendAdminFleetNotification(data.emailSubject, data.message)
      }
      console.log(`Notification created: ${data.title}`)
      return true
  }

  /**
   * Run all notification checks (to be called by cron job or scheduler)
   */
  static async runNotificationChecks(): Promise<{ status: 'completed' | 'disabled'; warnings: string[] }> {
    try {
      console.log('Running notification checks...')
      const result = await this.checkMaintenanceNotifications()
      console.log('Notification checks completed')
      return result
    } catch (error) {
      console.error('Error in runNotificationChecks:', error)
      throw error
    }
  }
}
