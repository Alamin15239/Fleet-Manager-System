import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get total trucks count (only user-created trucks)
    const totalTrucks = await db.truck.count({
      where: { isDeleted: false }
    })

    // Get active trucks count
    const activeTrucks = await db.truck.count({
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

    // Get recent maintenance records (only user-created)
    const recentMaintenance = await db.maintenanceRecord.findMany({
      where: { isDeleted: false },
      include: {
        truck: {
          select: {
            id: true,
            vin: true,
            make: true,
            model: true,
            year: true,
            licensePlate: true
          }
        }
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
      activeTrucks,
      upcomingMaintenance,
      overdueRepairs,
      totalMaintenanceCost,
      recentTrucks,
      recentMaintenance,
      monthlyMaintenanceData // Include raw data for client-side processing
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}