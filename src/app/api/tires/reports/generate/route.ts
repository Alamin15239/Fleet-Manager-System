import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Use custom JWT authentication
    const user = await requireAuth(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const template = searchParams.get('template')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeCharts = searchParams.get('includeCharts') === 'true'
    const format = searchParams.get('format') || 'pdf'
    
    // Filter parameters
    const manufacturer = searchParams.get('manufacturer')
    const origin = searchParams.get('origin')
    const plateNumber = searchParams.get('plateNumber')
    const trailerNumber = searchParams.get('trailerNumber')
    const driverName = searchParams.get('driverName')

    if (!template || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // Build where clause for filters
    const where: any = {}
    
    // Only add date filter if dates are reasonable
    const start = new Date(startDate)
    const end = new Date(endDate)
    const now = new Date()
    
    // If end date is not in the future, apply date filter
    if (end <= now) {
      where.createdAt = {
        gte: start,
        lte: end
      }
    }

    if (manufacturer) {
      where.manufacturer = manufacturer
    }

    if (origin) {
      where.origin = origin
    }

    if (plateNumber) {
      where.plateNumber = plateNumber
    }

    if (trailerNumber) {
      where.trailerNumber = trailerNumber
    }

    if (driverName) {
      where.driverName = driverName
    }

    // Fetch tire data - use historical data from tire records, not current vehicle data
    let tires = await db.tire.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
        // Removed vehicle include to use historical data from tire record itself
      }
    })

    // If no data found with date filter, try without date filter
    if (tires.length === 0 && where.createdAt) {
      const whereWithoutDate = { ...where }
      delete whereWithoutDate.createdAt
      
      tires = await db.tire.findMany({
        where: whereWithoutDate,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
          // Removed vehicle include to use historical data from tire record itself
        }
      })
    }

    // Calculate summary statistics
    const allVehicles = new Set([...tires.map(t => t.plateNumber).filter(Boolean), ...tires.map(t => t.trailerNumber).filter(Boolean)])
    const summary = {
      totalTires: tires.reduce((sum, t) => sum + (t.quantity || 0), 0),
      totalVehicles: allVehicles.size,
      totalTrailers: Array.from(new Set(tires.map(t => t.trailerNumber).filter(Boolean))).length,
      totalDrivers: Array.from(new Set(tires.map(t => t.driverName).filter(Boolean))).length,
      totalRecords: tires.length,
      averageTiresPerVehicle: allVehicles.size > 0 ? 
        (tires.reduce((sum, t) => sum + (t.quantity || 0), 0) / allVehicles.size).toFixed(1) : 0,
      manufacturers: Array.from(new Set(tires.map(t => t.manufacturer))).length,
      origins: Array.from(new Set(tires.map(t => t.origin))).length
    }

    // Generate analytics data based on template type
    let analytics = {}
    
    if (template === 'manufacturer-analysis') {
      const manufacturerStats = tires.reduce((acc: any, tire) => {
        if (!acc[tire.manufacturer]) {
          acc[tire.manufacturer] = {
            count: 0,
            records: 0,
            origins: new Set(),
            vehicles: new Set()
          }
        }
        acc[tire.manufacturer].count += (tire.quantity || 0)
        acc[tire.manufacturer].records += 1
        acc[tire.manufacturer].origins.add(tire.origin)
        if (tire.plateNumber) {
          acc[tire.manufacturer].vehicles.add(tire.plateNumber)
        }
        return acc
      }, {})

      // Convert Sets to counts
      Object.keys(manufacturerStats).forEach(manufacturer => {
        const stats = manufacturerStats[manufacturer]
        stats.origins = stats.origins.size
        stats.vehicles = stats.vehicles.size
      })

      analytics = { manufacturerStats }
    }

    if (template === 'vehicle-performance') {
      const vehicleStats = tires.reduce((acc: any, tire) => {
        if (!tire.plateNumber) return acc
        
        if (!acc[tire.plateNumber]) {
          acc[tire.plateNumber] = {
            plateNumber: tire.plateNumber,
            trailerNumber: tire.trailerNumber,
            driverName: tire.driverName,
            totalTires: 0,
            totalRecords: 0,
            manufacturers: new Set(),
            lastActivity: tire.createdAt
          }
        }
        
        acc[tire.plateNumber].totalTires += (tire.quantity || 0)
        acc[tire.plateNumber].totalRecords += 1
        acc[tire.plateNumber].manufacturers.add(tire.manufacturer)
        
        if (tire.createdAt > acc[tire.plateNumber].lastActivity) {
          acc[tire.plateNumber].lastActivity = tire.createdAt
        }
        
        return acc
      }, {})

      // Convert Sets to counts
      Object.keys(vehicleStats).forEach(plate => {
        vehicleStats[plate].manufacturers = vehicleStats[plate].manufacturers.size
      })

      analytics = { vehicleStats: Object.values(vehicleStats) }
    }

    const reportData = {
      template,
      dateRange: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      includeCharts,
      format,
      summary,
      tires,
      analytics,
      filters: {
        manufacturer,
        origin,
        plateNumber,
        trailerNumber,
        driverName
      }
    }

    return NextResponse.json(reportData)
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}