import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get actual counts from database
    const [totalTrucksCount, activeTrucksCount, trucks, maintenance] = await Promise.all([
      db.truck.count({ where: { isDeleted: false } }),
      db.truck.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      db.truck.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          make: true,
          model: true,
          year: true,
          licensePlate: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      db.maintenanceRecord.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          serviceType: true,
          totalCost: true,
          status: true,
          datePerformed: true,
          truck: {
            select: {
              make: true,
              model: true,
              licensePlate: true
            }
          }
        },
        orderBy: { datePerformed: 'desc' },
        take: 10
      })
    ])

    const totalTrucks = totalTrucksCount
    const activeTrucks = activeTrucksCount
    const recentTrucks = trucks.map(truck => ({
      ...truck,
      vehicleName: `${truck.year} ${truck.make} ${truck.model}`
    }))
    
    const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + (m.totalCost || 0), 0)
    const upcomingMaintenance = maintenance.filter(m => m.status === 'SCHEDULED').length
    const overdueRepairs = maintenance.filter(m => m.status === 'IN_PROGRESS').length
    const recentMaintenance = maintenance.map(m => ({
      ...m,
      vehicleName: m.truck ? `${m.truck.make} ${m.truck.model} (${m.truck.licensePlate})` : 'Unknown Vehicle'
    }))
    
    return NextResponse.json({
      totalTrucks,
      activeTrucks,
      upcomingMaintenance,
      overdueRepairs,
      totalMaintenanceCost,
      recentTrucks,
      recentMaintenance,
      timestamp: new Date().toISOString()
    })

  } catch (dbError) {
    console.log('Database query failed:', dbError instanceof Error ? dbError.message : 'Unknown error')
    return NextResponse.json({
      totalTrucks: 0,
      activeTrucks: 0,
      upcomingMaintenance: 0,
      overdueRepairs: 0,
      totalMaintenanceCost: 0,
      recentTrucks: [],
      recentMaintenance: [],
      error: 'Database connection failed'
    })
  }
}