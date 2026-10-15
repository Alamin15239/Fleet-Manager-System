import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permission-middleware'

// GET /api/tires/analytics - Get tire analytics and reports
export async function GET(request: NextRequest) {
  const authResult = await requirePermission(request, 'tire-management', 'read')
  if (authResult instanceof NextResponse) return authResult

  try {
    // OUT QTY is the source quantity; include every positive row regardless of origin.
    const activeTires = {
      quantity: { gt: 0 }
    }
    const now = new Date()

    // The tire table stores line quantities; count the units rather than rows.
    const totalTiresResult = await db.tire.aggregate({ where: activeTires, _sum: { quantity: true } })
    const totalTires = totalTiresResult._sum.quantity || 0
    
    // Count units with serials while excluding zero-quantity import rows.
    const tiresWithSerialResult = await db.tire.aggregate({
      where: { ...activeTires, serialNumber: { not: null } },
      _sum: { quantity: true }
    })
    const tiresWithSerial = tiresWithSerialResult._sum.quantity || 0
    
    // Get unique tire sizes
    const uniqueTireSizes = await db.tire.groupBy({
      by: ['tireSize'],
      where: activeTires,
      _count: { id: true },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } }
    })

    // Get tires by manufacturer
    const tiresByManufacturer = await db.tire.groupBy({
      by: ['manufacturer'],
      where: activeTires,
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } }
    })

    // Get tires by origin
    const tiresByOrigin = await db.tire.groupBy({
      by: ['origin'],
      where: activeTires,
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } }
    })

    // Get tires by vehicle (plate number)
    const tiresByVehicle = await db.tire.groupBy({
      by: ['plateNumber'],
      where: { ...activeTires, plateNumber: { not: null }, trailerNumber: null },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' }
    }})

    const tiresByTrailer = await db.tire.groupBy({
      by: ['trailerNumber'],
      where: { ...activeTires, trailerNumber: { not: null } },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } }
    })

    // Get tires by driver
    const tiresByDriver = await db.tire.groupBy({
      by: ['driverName'],
      _sum: { quantity: true },
      _count: { id: true },
      where: { ...activeTires, driverName: { not: null } },
      orderBy: { _sum: { quantity: 'desc' } }
    })

    // Get recent tire additions (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentTiresResult = await db.tire.aggregate({
      where: {
        ...activeTires,
        createdAt: {
          gte: thirtyDaysAgo,
          lte: now
        }
      },
      _sum: { quantity: true }
    })
    const recentTires = recentTiresResult._sum.quantity || 0

    // Get monthly tire distribution for the last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyTires = await db.tire.groupBy({
      by: ['createdAt'],
      _sum: { quantity: true },
      _count: { id: true },
      where: {
        ...activeTires,
        createdAt: {
          gte: sixMonthsAgo,
          lte: now
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Process monthly data for chart
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now)
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

    // Include both trucks and trailers in the top-vehicle view.
    const topVehicles = [
      ...tiresByVehicle.map(item => ({
        plateNumber: item.plateNumber,
        trailerNumber: null,
        driverName: null,
        tireCount: item._sum.quantity || 0
      })),
      ...tiresByTrailer.map(item => ({
        plateNumber: null,
        trailerNumber: item.trailerNumber,
        driverName: null,
        tireCount: item._sum.quantity || 0
      }))
    ].sort((a, b) => b.tireCount - a.tireCount).slice(0, 10)

    // Get top 10 drivers by tire count
    const topDrivers = await db.tire.groupBy({
      by: ['driverName'],
      _sum: { quantity: true },
      _count: { id: true },
      where: { ...activeTires, driverName: { not: null } },
      orderBy: { _sum: { quantity: 'desc' },
    }})

    // Get truck vs trailer tire distribution
    const truckTiresResult = await db.tire.aggregate({
      where: { ...activeTires, trailerNumber: null, plateNumber: { not: null } },
      _sum: { quantity: true }
    })
    const truckTires = truckTiresResult._sum.quantity || 0
    
    const trailerTiresResult = await db.tire.aggregate({
      where: { ...activeTires, trailerNumber: { not: null } },
      _sum: { quantity: true }
    })
    const trailerTires = trailerTiresResult._sum.quantity || 0
    
    // Get tire condition analysis (based on creation date)
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const recentCutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    
    const newTiresResult = await db.tire.aggregate({
      where: { ...activeTires, createdAt: { gte: recentCutoff, lte: now } },
      _sum: { quantity: true }
    })
    const newTires = newTiresResult._sum.quantity || 0
    
    const oldTiresResult = await db.tire.aggregate({
      where: { ...activeTires, createdAt: { lt: oneYearAgo } },
      _sum: { quantity: true }
    })
    const oldTires = oldTiresResult._sum.quantity || 0

    const [truckPlates, trailerNumbers] = await Promise.all([
      db.tire.findMany({ where: { ...activeTires, plateNumber: { not: null } }, select: { plateNumber: true }, distinct: ['plateNumber'] }),
      db.tire.findMany({ where: { ...activeTires, trailerNumber: { not: null } }, select: { trailerNumber: true }, distinct: ['trailerNumber'] })
    ])
    const totalVehicles = new Set([
      ...truckPlates.map(item => item.plateNumber).filter((value): value is string => Boolean(value)),
      ...trailerNumbers.map(item => item.trailerNumber).filter((value): value is string => Boolean(value))
    ]).size

    return NextResponse.json({
      summary: {
        totalTires,
        recentTires,
        totalVehicles,
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
        { condition: 'Regular', count: Math.max(0, totalTires - newTires - oldTires), percentage: totalTires > 0 ? Math.round((Math.max(0, totalTires - newTires - oldTires) / totalTires) * 100) : 0 },
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
