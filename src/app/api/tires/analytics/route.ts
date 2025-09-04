import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tires/analytics - Get tire analytics and reports
export async function GET(request: NextRequest) {
  try {
    // Get total tires count
    const totalTires = await db.tire.count()
    
    // Get tires with serial numbers
    const tiresWithSerial = await db.tire.count({
      where: { serialNumber: { not: null } }
    })
    
    // Get unique tire sizes
    const uniqueTireSizes = await db.tire.groupBy({
      by: ['tireSize'],
      _count: { id: true },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } }
    })

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

    // Get truck vs trailer tire distribution
    const truckTires = await db.tire.count({
      where: { trailerNumber: null, plateNumber: { not: null } }
    })
    
    const trailerTires = await db.tire.count({
      where: { trailerNumber: { not: null } }
    })
    
    // Get tire condition analysis (based on creation date)
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const recentCutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    
    const newTires = await db.tire.count({
      where: { createdAt: { gte: recentCutoff } }
    })
    
    const oldTires = await db.tire.count({
      where: { createdAt: { lt: oneYearAgo } }
    })

    return NextResponse.json({
      summary: {
        totalTires,
        recentTires,
        totalVehicles: tiresByVehicle.length,
        totalDrivers: tiresByDriver.length,
        tiresWithSerial,
        serialPercentage: totalTires > 0 ? Math.round((tiresWithSerial / totalTires) * 100) : 0,
        truckTires,
        trailerTires,
        newTires,
        oldTires
      },
      tireSizes: uniqueTireSizes.map(item => ({
        tireSize: item.tireSize,
        count: item._count.id,
        quantity: item._sum.quantity || 0
      })),
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
      })),
      vehicleTypes: [
        { type: 'Truck', count: truckTires, percentage: totalTires > 0 ? Math.round((truckTires / totalTires) * 100) : 0 },
        { type: 'Trailer', count: trailerTires, percentage: totalTires > 0 ? Math.round((trailerTires / totalTires) * 100) : 0 }
      ],
      tireCondition: [
        { condition: 'New (< 6 months)', count: newTires, percentage: totalTires > 0 ? Math.round((newTires / totalTires) * 100) : 0 },
        { condition: 'Regular', count: totalTires - newTires - oldTires, percentage: totalTires > 0 ? Math.round(((totalTires - newTires - oldTires) / totalTires) * 100) : 0 },
        { condition: 'Old (> 1 year)', count: oldTires, percentage: totalTires > 0 ? Math.round((oldTires / totalTires) * 100) : 0 }
      ]
    })
  } catch (error) {
    console.error('Error fetching tire analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tire analytics' },
      { status: 500 }
    )
  }
}