import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tires/analytics - Get tire analytics and reports
export async function GET(request: NextRequest) {
  try {
    // Get total tires count
    const totalTires = await db.tire.count()

    // Get tires by manufacturer
    const tiresByManufacturer = await db.tire.groupBy({
      by: ['manufacturer'],
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } }
    })

    // Get tires by origin
    const tiresByOrigin = await db.tire.groupBy({
      by: ['origin'],
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } }
    })

    // Get tires by vehicle (plate number)
    const tiresByVehicle = await db.tire.groupBy({
      by: ['plateNumber'],
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' }
    }})

    // Get tires by driver
    const tiresByDriver = await db.tire.groupBy({
      by: ['driverName'],
      _sum: { quantity: true },
      _count: { id: true },
      where: { driverName: { not: null } },
      orderBy: { _sum: { quantity: 'desc' } }
    })

    // Get recent tire additions (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentTires = await db.tire.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    })

    // Get monthly tire distribution for the last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyTires = await db.tire.groupBy({
      by: ['createdAt'],
      _sum: { quantity: true },
      _count: { id: true },
      where: {
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Process monthly data for chart
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date()
      date.setMonth(date.getMonth() - i)
      const monthKey = date.toISOString().slice(0, 7) // YYYY-MM format
      
      const monthData = monthlyTires.filter(item => 
        item.createdAt.toISOString().slice(0, 7) === monthKey
      )
      
      monthlyData.push({
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        count: monthData.reduce((sum, item) => sum + item._count.id, 0),
        quantity: monthData.reduce((sum, item) => sum + (item._sum.quantity || 0), 0)
      })
    }

    // Get top 10 vehicles by tire count using historical data from tire records
    const topVehicles = tiresByVehicle.slice(0, 10).map(item => ({
      plateNumber: item.plateNumber,
      trailerNumber: null, // Historical data from tire record
      driverName: null, // Historical data from tire record  
      tireCount: item._sum.quantity || 0
    }))

    // Get top 10 drivers by tire count
    const topDrivers = await db.tire.groupBy({
      by: ['driverName'],
      _sum: { quantity: true },
      _count: { id: true },
      where: { driverName: { not: null } },
      orderBy: { _sum: { quantity: 'desc' },
    }})

    return NextResponse.json({
      summary: {
        totalTires,
        recentTires,
        totalVehicles: tiresByVehicle.length,
        totalDrivers: tiresByDriver.length
      },
      byManufacturer: tiresByManufacturer.map(item => ({
        manufacturer: item.manufacturer,
        count: item._count.id,
        quantity: item._sum.quantity || 0
      })),
      byOrigin: tiresByOrigin.map(item => ({
        origin: item.origin,
        count: item._count.id,
        quantity: item._sum.quantity || 0
      })),
      byVehicle: tiresByVehicle.map(item => ({
        plateNumber: item.plateNumber,
        count: item._count.id,
        quantity: item._sum.quantity || 0
      })),
      byDriver: tiresByDriver.map(item => ({
        driverName: item.driverName,
        count: item._count.id,
        quantity: item._sum.quantity || 0
      })),
      monthlyData,
      topVehicles,
      topDrivers: topDrivers.map(driver => ({
        driverName: driver.driverName,
        tireCount: driver._sum.quantity || 0,
        recordCount: driver._count.id
      }))
    })
  } catch (error) {
    console.error('Error fetching tire analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tire analytics' },
      { status: 500 }
    )
  }
}