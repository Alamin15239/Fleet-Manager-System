import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

type CostRecord = {
  serviceType: string
  status: string
  totalCost: number
  date: Date
  mechanic: string | null
}

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'dashboard', 'read')

    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const sixMonthsAgo = new Date(now)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysFromNow = new Date(now)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const [
      totalTrucks,
      activeTrucks,
      totalTrailers,
      activeTrailers,
      trucks,
      truckMaintenance,
      trailerMaintenance,
      jobCards,
      scheduledTruckCount,
      scheduledTrailerCount,
      overdueTruckCount,
      overdueTrailerCount,
      upcomingJobCardServices,
      overdueOpenJobCards,
      truckAlerts,
      trailerAlerts
    ] = await Promise.all([
      db.truck.count({ where: { isDeleted: false } }),
      db.truck.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      db.trailer.count({ where: { isDeleted: false } }),
      db.trailer.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      db.truck.findMany({
        where: { isDeleted: false },
        select: { id: true, make: true, model: true, year: true, licensePlate: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      db.maintenanceRecord.findMany({
        where: { isDeleted: false, datePerformed: { gte: sixMonthsAgo } },
        select: { id: true, serviceType: true, totalCost: true, status: true, datePerformed: true, mechanicName: true, mechanic: { select: { name: true } }, truck: { select: { make: true, model: true, licensePlate: true } } },
        orderBy: { datePerformed: 'desc' }
      }),
      db.trailerMaintenanceRecord.findMany({
        where: { isDeleted: false, datePerformed: { gte: sixMonthsAgo } },
        select: { id: true, serviceType: true, totalCost: true, status: true, datePerformed: true, mechanicName: true, mechanic: { select: { name: true } }, trailer: { select: { number: true } } },
        orderBy: { datePerformed: 'desc' }
      }),
      db.workshopJobCard.findMany({
        where: { serviceDate: { gte: sixMonthsAgo } },
        select: { id: true, jobNumber: true, serviceType: true, totalCost: true, status: true, serviceDate: true, technicianName: true, truck: { select: { make: true, model: true, licensePlate: true } }, trailer: { select: { number: true } } },
        orderBy: { serviceDate: 'desc' }
      }),
      db.maintenanceRecord.count({ where: { isDeleted: false, nextServiceDue: { gte: today, lte: thirtyDaysFromNow } } }),
      db.trailerMaintenanceRecord.count({ where: { isDeleted: false, nextServiceDue: { gte: today, lte: thirtyDaysFromNow } } }),
      db.maintenanceRecord.count({ where: { isDeleted: false, nextServiceDue: { lt: today } } }),
      db.trailerMaintenanceRecord.count({ where: { isDeleted: false, nextServiceDue: { lt: today } } }),
      db.workshopJobCard.count({ where: { nextServiceDate: { gte: today, lte: thirtyDaysFromNow } } }),
      db.workshopJobCard.count({ where: { status: 'OPEN', serviceDate: { lt: today } } }),
      db.predictiveAlert.findMany({
        where: { isResolved: false },
        select: { id: true, title: true, alertType: true, severity: true, predictedFailureDate: true, truck: { select: { licensePlate: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      db.trailerPredictiveAlert.findMany({
        where: { isResolved: false },
        select: { id: true, title: true, alertType: true, severity: true, predictedFailureDate: true, trailer: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ])

    const costRecords: CostRecord[] = [
      ...truckMaintenance.map(record => ({
        serviceType: record.serviceType,
        status: record.status,
        totalCost: record.totalCost || 0,
        date: record.datePerformed,
        mechanic: record.mechanic?.name || record.mechanicName || null
      })),
      ...trailerMaintenance.map(record => ({
        serviceType: record.serviceType,
        status: record.status,
        totalCost: record.totalCost || 0,
        date: record.datePerformed,
        mechanic: record.mechanic?.name || record.mechanicName || null
      })),
      ...jobCards.map(card => ({
        serviceType: card.serviceType,
        status: card.status,
        totalCost: card.totalCost || 0,
        date: card.serviceDate,
        mechanic: card.technicianName || null
      }))
    ]

    const totalMaintenanceCost = costRecords.reduce((sum, record) => sum + record.totalCost, 0)
    const monthlyMaintenanceCost = costRecords
      .filter(record => record.date >= thirtyDaysAgo)
      .reduce((sum, record) => sum + record.totalCost, 0)

    const maintenanceByType: Record<string, number> = {}
    const maintenanceByStatus: Record<string, number> = {}
    const monthlyBuckets = new Map<string, { month: string; cost: number; count: number }>()
    const mechanicBuckets = new Map<string, { name: string; count: number; cost: number }>()

    for (const record of costRecords) {
      maintenanceByType[record.serviceType] = (maintenanceByType[record.serviceType] || 0) + 1
      const statusLabel = record.status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
      maintenanceByStatus[statusLabel] = (maintenanceByStatus[statusLabel] || 0) + 1

      const monthKey = `${record.date.getFullYear()}-${String(record.date.getMonth() + 1).padStart(2, '0')}`
      const monthBucket = monthlyBuckets.get(monthKey) || {
        month: record.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        cost: 0,
        count: 0
      }
      monthBucket.cost += record.totalCost
      monthBucket.count += 1
      monthlyBuckets.set(monthKey, monthBucket)

      if (record.mechanic) {
        const mechanicBucket = mechanicBuckets.get(record.mechanic) || { name: record.mechanic, count: 0, cost: 0 }
        mechanicBucket.count += 1
        mechanicBucket.cost += record.totalCost
        mechanicBuckets.set(record.mechanic, mechanicBucket)
      }
    }

    const recentMaintenance = [
      ...truckMaintenance.slice(0, 10).map(record => ({
        id: record.id,
        serviceType: record.serviceType,
        totalCost: record.totalCost,
        status: record.status,
        datePerformed: record.datePerformed,
        vehicleName: record.truck ? `${record.truck.make} ${record.truck.model} (${record.truck.licensePlate})` : 'Unknown Vehicle'
      })),
      ...trailerMaintenance.slice(0, 10).map(record => ({
        id: record.id,
        serviceType: record.serviceType,
        totalCost: record.totalCost,
        status: record.status,
        datePerformed: record.datePerformed,
        vehicleName: record.trailer ? `Trailer ${record.trailer.number}` : 'Unknown Trailer'
      })),
      ...jobCards.slice(0, 10).map(card => ({
        id: `job-card:${card.id}`,
        serviceType: `Job Card · ${card.serviceType}`,
        totalCost: card.totalCost,
        status: card.status,
        datePerformed: card.serviceDate,
        vehicleName: card.truck
          ? `${card.truck.make} ${card.truck.model} (${card.truck.licensePlate})`
          : card.trailer ? `Trailer ${card.trailer.number}` : card.jobNumber
      }))
    ].sort((a, b) => new Date(b.datePerformed).getTime() - new Date(a.datePerformed).getTime()).slice(0, 10)

    const predictiveAlerts = [
      ...truckAlerts.map(alert => ({
        id: alert.id,
        vehicle: `Truck ${alert.truck.licensePlate}`,
        type: alert.title || alert.alertType,
        severity: alert.severity,
        dueDate: alert.predictedFailureDate?.toISOString() || ''
      })),
      ...trailerAlerts.map(alert => ({
        id: alert.id,
        vehicle: `Trailer ${alert.trailer.number}`,
        type: alert.title || alert.alertType,
        severity: alert.severity,
        dueDate: alert.predictedFailureDate?.toISOString() || ''
      }))
    ].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0, 10)

    return NextResponse.json({
      totalTrucks,
      totalTrailers,
      totalFleet: totalTrucks + totalTrailers,
      activeTrucks,
      activeTrailers,
      activeFleet: activeTrucks + activeTrailers,
      upcomingMaintenance: scheduledTruckCount + scheduledTrailerCount + upcomingJobCardServices,
      overdueRepairs: overdueTruckCount + overdueTrailerCount + overdueOpenJobCards,
      totalMaintenanceCost,
      monthlyMaintenanceCost,
      recentTrucks: trucks.map(truck => ({ ...truck, vehicleName: `${truck.year} ${truck.make} ${truck.model}` })),
      recentMaintenance,
      maintenanceByType,
      maintenanceByStatus,
      monthlyTrends: Array.from(monthlyBuckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value),
      topMechanics: Array.from(mechanicBuckets.values()).sort((a, b) => b.count - a.count).slice(0, 5),
      criticalVehicles: [],
      predictiveAlerts,
      timestamp: now.toISOString()
    })
  } catch (error) {
    console.error('Dashboard stats query failed:', error instanceof Error ? error.message : 'Unknown error')
    const status = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message) ? 401 : error instanceof Error && error.message === 'Insufficient permissions' ? 403 : 503
    return NextResponse.json(
      { error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : 'Unable to load dashboard data' },
      { status }
    )
  }
}
