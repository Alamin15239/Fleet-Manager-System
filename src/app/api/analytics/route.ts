import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

type AnalyticsRecord = {
  serviceType: string
  date: Date
  status: string
  partsCost: number
  laborCost: number
  totalCost: number
  downtimeHours: number | null
  mechanicName: string | null
  vehicleName: string
  vehicleId: string
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '6months'
    const truckId = searchParams.get('truckId') || 'all'
    const monthsByPeriod: Record<string, number> = { '1month': 1, '3months': 3, '6months': 6, '1year': 12 }
    const months = monthsByPeriod[period] || 6
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setMonth(startDate.getMonth() - months)
    const truckFilter = truckId === 'all' ? {} : { truckId }

    const [truckRecords, trailerRecords, jobCards, truckAlerts, trailerAlerts] = await Promise.all([
      db.maintenanceRecord.findMany({
        where: { isDeleted: false, datePerformed: { gte: startDate, lte: endDate }, ...truckFilter },
        select: {
          serviceType: true, datePerformed: true, status: true, partsCost: true, laborCost: true,
          totalCost: true, downtimeHours: true, mechanicName: true, truckId: true,
          mechanic: { select: { name: true } }, truck: { select: { licensePlate: true } }
        },
        orderBy: { datePerformed: 'asc' }
      }),
      truckId === 'all' ? db.trailerMaintenanceRecord.findMany({
        where: { isDeleted: false, datePerformed: { gte: startDate, lte: endDate } },
        select: {
          serviceType: true, datePerformed: true, status: true, partsCost: true, laborCost: true,
          totalCost: true, downtimeHours: true, mechanicName: true, trailerId: true,
          mechanic: { select: { name: true } }, trailer: { select: { number: true } }
        },
        orderBy: { datePerformed: 'asc' }
      }) : Promise.resolve([]),
      db.workshopJobCard.findMany({
        where: {
          serviceDate: { gte: startDate, lte: endDate },
          ...(truckId !== 'all' ? { truckId } : {})
        },
        select: {
          serviceType: true, serviceDate: true, status: true, partsCost: true, laborCost: true,
          totalCost: true, technicianName: true, truckId: true, trailerId: true,
          truck: { select: { licensePlate: true } }, trailer: { select: { number: true } }
        },
        orderBy: { serviceDate: 'asc' }
      }),
      db.predictiveAlert.findMany({
        where: { isResolved: false, ...(truckId !== 'all' ? { truckId } : {}) },
        select: { id: true, title: true, description: true, severity: true, predictedFailureDate: true, truck: { select: { licensePlate: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      truckId === 'all' ? db.trailerPredictiveAlert.findMany({
        where: { isResolved: false },
        select: { id: true, title: true, description: true, severity: true, predictedFailureDate: true, trailer: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20
      }) : Promise.resolve([])
    ])

    const records: AnalyticsRecord[] = [
      ...truckRecords.map(record => ({
        serviceType: record.serviceType,
        date: record.datePerformed,
        status: record.status,
        partsCost: record.partsCost || 0,
        laborCost: record.laborCost || 0,
        totalCost: record.totalCost || 0,
        downtimeHours: record.downtimeHours,
        mechanicName: record.mechanic?.name || record.mechanicName || null,
        vehicleName: record.truck?.licensePlate || 'Unknown truck',
        vehicleId: record.truckId
      })),
      ...trailerRecords.map(record => ({
        serviceType: record.serviceType,
        date: record.datePerformed,
        status: record.status,
        partsCost: record.partsCost || 0,
        laborCost: record.laborCost || 0,
        totalCost: record.totalCost || 0,
        downtimeHours: record.downtimeHours,
        mechanicName: record.mechanic?.name || record.mechanicName || null,
        vehicleName: `Trailer ${record.trailer?.number || ''}`,
        vehicleId: record.trailerId
      })),
      ...jobCards.map(card => ({
        serviceType: card.serviceType,
        date: card.serviceDate,
        status: card.status,
        partsCost: card.partsCost || 0,
        laborCost: card.laborCost || 0,
        totalCost: card.totalCost || 0,
        downtimeHours: null,
        mechanicName: card.technicianName || null,
        vehicleName: card.truck?.licensePlate || (card.trailer ? `Trailer ${card.trailer.number}` : 'Unknown vehicle'),
        vehicleId: card.truckId || card.trailerId || ''
      }))
    ].sort((a, b) => a.date.getTime() - b.date.getTime())

    const maintenanceTrends = []
    const monthCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    while (monthCursor <= lastMonth) {
      const monthStart = new Date(monthCursor)
      const nextMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1)
      const monthRecords = records.filter(record => record.date >= monthStart && record.date < nextMonth)
      maintenanceTrends.push({
        month: monthCursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        scheduled: monthRecords.filter(record => record.status.toUpperCase() === 'SCHEDULED').length,
        completed: monthRecords.filter(record => record.status.toUpperCase() === 'COMPLETED').length,
        inProgress: monthRecords.filter(record => record.status.toUpperCase() === 'IN_PROGRESS').length,
        overdue: monthRecords.filter(record => record.status.toUpperCase() === 'SCHEDULED' && record.date < endDate).length
      })
      monthCursor.setMonth(monthCursor.getMonth() + 1)
    }

    const totalPartsCost = records.reduce((sum, record) => sum + record.partsCost, 0)
    const totalLaborCost = records.reduce((sum, record) => sum + record.laborCost, 0)
    const totalCost = records.reduce((sum, record) => sum + record.totalCost, 0)
    const costAnalysis = [
      { category: 'Parts', cost: totalPartsCost, percentage: totalCost > 0 ? Math.round((totalPartsCost / totalCost) * 100) : 0 },
      { category: 'Labor', cost: totalLaborCost, percentage: totalCost > 0 ? Math.round((totalLaborCost / totalCost) * 100) : 0 }
    ]

    const vehicles = new Map<string, { name: string; maintenanceCost: number; downtime: number }>()
    const mechanics = new Map<string, { name: string; completedJobs: number; totalCost: number }>()
    for (const record of records) {
      const vehicle = vehicles.get(record.vehicleId) || { name: record.vehicleName, maintenanceCost: 0, downtime: 0 }
      vehicle.maintenanceCost += record.totalCost
      vehicle.downtime += record.downtimeHours || 0
      vehicles.set(record.vehicleId, vehicle)

      if (record.mechanicName && record.status.toUpperCase() === 'COMPLETED') {
        const mechanic = mechanics.get(record.mechanicName) || { name: record.mechanicName, completedJobs: 0, totalCost: 0 }
        mechanic.completedJobs += 1
        mechanic.totalCost += record.totalCost
        mechanics.set(record.mechanicName, mechanic)
      }
    }

    const predictiveInsights = [
      ...truckAlerts.map(alert => ({
        type: alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'warning' : 'info',
        title: alert.title,
        description: `${alert.truck.licensePlate}: ${alert.description}`,
        impact: alert.severity.toLowerCase()
      })),
      ...trailerAlerts.map(alert => ({
        type: alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'warning' : 'info',
        title: alert.title,
        description: `Trailer ${alert.trailer.number}: ${alert.description}`,
        impact: alert.severity.toLowerCase()
      }))
    ]

    return NextResponse.json({
      maintenanceTrends,
      costAnalysis,
      truckPerformance: Array.from(vehicles.values()).map(vehicle => ({ ...vehicle, uptime: null })),
      mechanicProductivity: Array.from(mechanics.values()).map(mechanic => ({
        ...mechanic,
        avgRepairTime: null,
        efficiency: null
      })),
      predictiveInsights
    })
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : 'Failed to fetch analytics data' },
      { status: unauthorized ? 401 : 500 }
    )
  }
}
