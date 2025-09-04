import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Test database connection first
    try {
      await db.$queryRaw`SELECT 1`
      console.log('Database connection successful')
    } catch (dbError) {
      console.error('Database connection failed:', dbError)
      return NextResponse.json({
        totalTrucks: 0,
        totalTrailers: 0,
        totalFleet: 0,
        activeTrucks: 0,
        activeTrailers: 0,
        activeFleet: 0,
        upcomingMaintenance: 0,
        overdueRepairs: 0,
        totalMaintenanceCost: 0,
        recentTrucks: [],
        recentMaintenance: [],
        monthlyMaintenanceData: [],
        error: 'Database connection failed'
      })
    }

    // Get total trucks count (only user-created trucks)
    console.log('Fetching truck count...')
    const totalTrucks = await db.truck.count({
      where: { isDeleted: false }
    })
    console.log('Total trucks found:', totalTrucks)
    
    // Debug: Also check without isDeleted filter
    const allTrucksCount = await db.truck.count()
    console.log('All trucks in database:', allTrucksCount)

    // Get total trailers count
    const totalTrailers = await db.trailer.count({
      where: { isDeleted: false }
    })

    // Get active trucks count
    const activeTrucks = await db.truck.count({
      where: { 
        status: 'ACTIVE',
        isDeleted: false
      }
    })

    // Get active trailers count
    const activeTrailers = await db.trailer.count({
      where: { 
        status: 'ACTIVE',
        isDeleted: false
      }
    })

    // Get upcoming maintenance (scheduled and not overdue)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Set to start of day for consistent comparison
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    const upcomingMaintenance = await db.maintenanceRecord.count({
      where: {
        status: 'SCHEDULED',
        datePerformed: {
          gte: today,
          lte: thirtyDaysFromNow
        },
        isDeleted: false
      }
    })

    // Get overdue repairs (scheduled and past due date)
    const overdueRepairs = await db.maintenanceRecord.count({
      where: {
        status: 'SCHEDULED',
        datePerformed: {
          lt: today
        },
        isDeleted: false
      }
    })

    // Get total maintenance cost for all time (only user-added maintenance records)
    const maintenanceCosts = await db.maintenanceRecord.aggregate({
      where: { isDeleted: false },
      _sum: {
        totalCost: true
      }
    })

    const totalMaintenanceCost = maintenanceCosts._sum.totalCost || 0

    // Get recent trucks (only user-created)
    const recentTrucks = await db.truck.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    // Get recent maintenance records using historical data
    const recentMaintenance = await db.maintenanceRecord.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        serviceType: true,
        totalCost: true,
        status: true,
        datePerformed: true,
        vehicleName: true,
        mechanicName: true,
        driverName: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    // Calculate monthly cost data only from actual user-created maintenance records
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    sixMonthsAgo.setHours(0, 0, 0, 0)
    
    const monthlyMaintenanceData = await db.maintenanceRecord.findMany({
      where: {
        datePerformed: {
          gte: sixMonthsAgo
        },
        isDeleted: false
      },
      select: {
        datePerformed: true,
        totalCost: true,
        serviceType: true
      }
    })

    return NextResponse.json({
      totalTrucks,
      totalTrailers,
      totalFleet: totalTrucks + totalTrailers,
      activeTrucks,
      activeTrailers,
      activeFleet: activeTrucks + activeTrailers,
      upcomingMaintenance,
      overdueRepairs,
      totalMaintenanceCost,
      recentTrucks,
      recentMaintenance,
      monthlyMaintenanceData, // Include raw data for client-side processing
      debug: {
        totalTrucks,
        allTrucksCount,
        activeTrucks,
        totalTrailers,
        activeTrailers
      }
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    // Return default values instead of 500 error
    return NextResponse.json({
      totalTrucks: 0,
      totalTrailers: 0,
      totalFleet: 0,
      activeTrucks: 0,
      activeTrailers: 0,
      activeFleet: 0,
      upcomingMaintenance: 0,
      overdueRepairs: 0,
      totalMaintenanceCost: 0,
      recentTrucks: [],
      recentMaintenance: [],
      monthlyMaintenanceData: [],
      error: 'Database connection failed'
    })
  }
}