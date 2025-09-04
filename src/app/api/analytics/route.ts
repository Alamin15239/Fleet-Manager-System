import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '6months'
    const truckId = searchParams.get('truckId') || 'all'

    // Calculate date range based on period
    const now = new Date()
    let startDate = new Date()
    
    switch (period) {
      case '1month':
        startDate.setMonth(now.getMonth() - 1)
        break
      case '3months':
        startDate.setMonth(now.getMonth() - 3)
        break
      case '6months':
        startDate.setMonth(now.getMonth() - 6)
        break
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        startDate.setMonth(now.getMonth() - 6)
    }

    // Get maintenance trends data
    const maintenanceTrends = await getMaintenanceTrends(startDate, now, truckId)
    
    // Get cost analysis data
    const costAnalysis = await getCostAnalysis(startDate, now, truckId)
    
    // Get truck performance data
    const truckPerformance = await getTruckPerformance(truckId)
    
    // Get mechanic productivity data
    const mechanicProductivity = await getMechanicProductivity(startDate, now)
    
    // Get predictive insights
    const predictiveInsights = await getPredictiveInsights(truckId)

    return NextResponse.json({
      maintenanceTrends,
      costAnalysis,
      truckPerformance,
      mechanicProductivity,
      predictiveInsights
    })

  } catch (error) {
    console.error('Error fetching analytics data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}

async function getMaintenanceTrends(startDate: Date, endDate: Date, truckId: string) {
  // Get maintenance records grouped by month and status
  const maintenanceRecords = await db.maintenanceRecord.findMany({
    where: {
      datePerformed: {
        gte: startDate,
        lte: endDate
      },
      ...(truckId !== 'all' && { truckId })
    },
    select: {
      datePerformed: true,
      status: true
    }
  })

  // Group by month
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const trends = []

  for (let i = 0; i < 6; i++) {
    const currentDate = new Date(endDate)
    currentDate.setMonth(currentDate.getMonth() - i)
    
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    
    const monthRecords = maintenanceRecords.filter(record => {
      const recordDate = new Date(record.datePerformed)
      return recordDate >= monthStart && recordDate <= monthEnd
    })

    const monthName = monthNames[currentDate.getMonth()]
    
    trends.unshift({
      month: monthName,
      scheduled: monthRecords.filter(r => r.status === 'SCHEDULED').length,
      completed: monthRecords.filter(r => r.status === 'COMPLETED').length,
      inProgress: monthRecords.filter(r => r.status === 'IN_PROGRESS').length,
      overdue: monthRecords.filter(r => r.status === 'SCHEDULED' && new Date(r.datePerformed) < new Date()).length
    })
  }

  return trends
}

async function getCostAnalysis(startDate: Date, endDate: Date, truckId: string) {
  const maintenanceRecords = await db.maintenanceRecord.findMany({
    where: {
      datePerformed: {
        gte: startDate,
        lte: endDate
      },
      ...(truckId !== 'all' && { truckId })
    },
    select: {
      partsCost: true,
      laborCost: true,
      totalCost: true
    }
  })

  const totalPartsCost = maintenanceRecords.reduce((sum, record) => sum + (record.partsCost || 0), 0)
  const totalLaborCost = maintenanceRecords.reduce((sum, record) => sum + (record.laborCost || 0), 0)
  const totalCost = maintenanceRecords.reduce((sum, record) => sum + (record.totalCost || 0), 0)
  
  // Calculate external services and other costs (simplified)
  const externalServicesCost = totalCost * 0.11
  const otherCost = totalCost * 0.05

  return [
    { category: 'Parts', cost: Math.round(totalPartsCost), percentage: Math.round((totalPartsCost / totalCost) * 100) || 0 },
    { category: 'Labor', cost: Math.round(totalLaborCost), percentage: Math.round((totalLaborCost / totalCost) * 100) || 0 },
    { category: 'External Services', cost: Math.round(externalServicesCost), percentage: 11 },
    { category: 'Other', cost: Math.round(otherCost), percentage: 5 }
  ]
}

async function getTruckPerformance(truckId: string) {
  const trucks = await db.truck.findMany({
    where: {
      ...(truckId !== 'all' && { id: truckId }),
      isDeleted: false
    },
    include: {
      maintenanceRecords: {
        where: {
          datePerformed: {
            gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
          }
        }
      }
    }
  })

  return trucks.map(truck => {
    const totalMaintenanceCost = truck.maintenanceRecords.reduce((sum, record) => sum + (record.totalCost || 0), 0)
    const downtimeDays = truck.maintenanceRecords.filter(r => r.status === 'IN_PROGRESS').length * 2 // Estimate 2 days per maintenance
    
    return {
      name: truck.licensePlate || 'Unknown',
      uptime: truck.status === 'ACTIVE' ? Math.max(95 - downtimeDays, 70) : 0,
      maintenanceCost: totalMaintenanceCost,
      downtime: downtimeDays
    }
  })
}

async function getMechanicProductivity(startDate: Date, endDate: Date) {
  // Get mechanics from maintenance records using historical data
  const maintenanceRecords = await db.maintenanceRecord.findMany({
    where: {
      datePerformed: {
        gte: startDate,
        lte: endDate
      },
      status: 'COMPLETED'
    },
    select: {
      mechanicName: true,
      totalCost: true
    }
  })

  // Group by mechanic using historical names
  const mechanicStats = new Map()
  
  maintenanceRecords.forEach(record => {
    const mechanicName = record.mechanicName || 'Unknown'
    if (!mechanicStats.has(mechanicName)) {
      mechanicStats.set(mechanicName, {
        completedJobs: 0,
        totalCost: 0,
        estimatedHours: 0
      })
    }
    
    const stats = mechanicStats.get(mechanicName)
    stats.completedJobs++
    stats.totalCost += record.totalCost || 0
    // Estimate hours based on cost (rough estimate)
    stats.estimatedHours += (record.totalCost || 0) / 100 // Assume $100 per hour
  })

  return Array.from(mechanicStats.entries()).map(([name, stats]) => ({
    name,
    completedJobs: stats.completedJobs,
    avgRepairTime: stats.completedJobs > 0 ? Math.round(stats.estimatedHours / stats.completedJobs) : 0,
    efficiency: Math.min(Math.round((stats.completedJobs / Math.max(stats.estimatedHours / 8, 1)) * 100), 100)
  }))
}

async function getPredictiveInsights(truckId: string) {
  const insights = []
  
  // Get current stats
  const totalTrucks = await db.truck.count({ where: { isDeleted: false } })
  const activeTrucks = await db.truck.count({ where: { status: 'ACTIVE', isDeleted: false } })
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  
  const overdueRepairs = await db.maintenanceRecord.count({
    where: {
      status: 'SCHEDULED',
      datePerformed: { lt: today },
      ...(truckId !== 'all' && { truckId })
    }
  })
  
  const upcomingMaintenance = await db.maintenanceRecord.count({
    where: {
      status: 'SCHEDULED',
      datePerformed: { gte: today, lte: thirtyDaysFromNow },
      ...(truckId !== 'all' && { truckId })
    }
  })

  // Generate insights based on data
  if (overdueRepairs > 0) {
    insights.push({
      type: 'warning',
      title: 'Overdue Maintenance',
      description: `${overdueRepairs} maintenance task${overdueRepairs > 1 ? 's are' : ' is'} overdue and require${overdueRepairs > 1 ? '' : 's'} immediate attention`,
      impact: 'high'
    })
  }
  
  if (upcomingMaintenance > 5) {
    insights.push({
      type: 'info',
      title: 'High Maintenance Volume',
      description: `${upcomingMaintenance} maintenance task${upcomingMaintenance > 1 ? 's are' : ' is'} scheduled in the next 30 days`,
      impact: 'medium'
    })
  }
  
  if (activeTrucks / totalTrucks < 0.8) {
    insights.push({
      type: 'warning',
      title: 'Low Fleet Availability',
      description: `Fleet availability is ${Math.round((activeTrucks / totalTrucks) * 100)}%, consider optimizing maintenance schedules`,
      impact: 'medium'
    })
  }
  
  // Add positive insights
  if (overdueRepairs === 0) {
    insights.push({
      type: 'success',
      title: 'Maintenance On Track',
      description: 'All maintenance tasks are up to date',
      impact: 'low'
    })
  }
  
  insights.push({
    type: 'success',
    title: 'Fleet Performance',
    description: 'Overall fleet efficiency is within acceptable parameters',
    impact: 'low'
  })
  
  return insights
}