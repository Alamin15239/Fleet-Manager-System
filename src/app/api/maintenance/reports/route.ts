import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const serviceType = searchParams.get('serviceType')
    const truckId = searchParams.get('truckId')
    const mechanicId = searchParams.get('mechanicId')

    const whereClause: any = {
      isDeleted: false
    }

    if (startDate) {
      whereClause.datePerformed = { gte: new Date(startDate) }
    }

    if (endDate) {
      whereClause.datePerformed = {
        ...(whereClause.datePerformed || {}),
        lte: new Date(endDate)
      }
    }

    if (search) {
      whereClause.OR = [
        { serviceType: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { truck: { licensePlate: { contains: search, mode: 'insensitive' } } },
        { truck: { make: { contains: search, mode: 'insensitive' } } },
        { truck: { model: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (serviceType && serviceType !== 'all') {
      whereClause.serviceType = { contains: serviceType, mode: 'insensitive' }
    }

    if (truckId) {
      whereClause.truckId = truckId
    }

    if (mechanicId) {
      whereClause.mechanicId = mechanicId
    }

    const [records, totalCount] = await Promise.all([
      db.maintenanceRecord.findMany({
        where: whereClause,
        include: {
          truck: {
            select: {
              id: true,
              vin: true,
              make: true,
              model: true,
              year: true,
              licensePlate: true,
              currentMileage: true,
              driverName: true
            }
          },
          mechanic: {
            select: {
              id: true,
              name: true,
              specialty: true
            }
          },
          maintenanceJob: {
            select: {
              id: true,
              name: true,
              category: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { datePerformed: 'desc' }
      }),
      db.maintenanceRecord.count({ where: whereClause })
    ])

    // Calculate summary statistics
    const totalCost = records.reduce((sum, record) => sum + (record.totalCost || 0), 0)
    const totalPartsCost = records.reduce((sum, record) => sum + (record.partsCost || 0), 0)
    const totalLaborCost = records.reduce((sum, record) => sum + (record.laborCost || 0), 0)
    const averageCost = totalCount > 0 ? totalCost / totalCount : 0

    // Service type breakdown
    const serviceTypeBreakdown = records.reduce((acc, record) => {
      const type = record.serviceType || 'Unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Status breakdown
    const statusBreakdown = records.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Monthly breakdown
    const monthlyBreakdown = records.reduce((acc, record) => {
      const month = new Date(record.datePerformed).toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      })
      if (!acc[month]) {
        acc[month] = { count: 0, cost: 0 }
      }
      acc[month].count += 1
      acc[month].cost += record.totalCost || 0
      return acc
    }, {} as Record<string, { count: number; cost: number }>)

    // Top mechanics
    const mechanicBreakdown = records.reduce((acc, record) => {
      const mechanicName = record.mechanic?.name || record.mechanicName || 'Unassigned'
      if (!acc[mechanicName]) {
        acc[mechanicName] = { count: 0, cost: 0 }
      }
      acc[mechanicName].count += 1
      acc[mechanicName].cost += record.totalCost || 0
      return acc
    }, {} as Record<string, { count: number; cost: number }>)

    // Vehicle breakdown
    const vehicleBreakdown = records.reduce((acc, record) => {
      const vehicleName = record.truck 
        ? `${record.truck.licensePlate} - ${record.truck.year} ${record.truck.make} ${record.truck.model}`
        : 'Unknown Vehicle'
      if (!acc[vehicleName]) {
        acc[vehicleName] = { count: 0, cost: 0 }
      }
      acc[vehicleName].count += 1
      acc[vehicleName].cost += record.totalCost || 0
      return acc
    }, {} as Record<string, { count: number; cost: number }>)

    return NextResponse.json({
      success: true,
      data: records,
      summary: {
        totalRecords: totalCount,
        totalCost,
        totalPartsCost,
        totalLaborCost,
        averageCost,
        completedCount: records.filter(r => r.status === 'COMPLETED').length,
        inProgressCount: records.filter(r => r.status === 'IN_PROGRESS').length,
        scheduledCount: records.filter(r => r.status === 'SCHEDULED').length,
        serviceTypeBreakdown,
        statusBreakdown,
        monthlyBreakdown,
        mechanicBreakdown,
        vehicleBreakdown
      }
    })

  } catch (error) {
    console.error('Error fetching maintenance reports:', error)
    return NextResponse.json({
      success: true,
      data: [],
      summary: {
        totalRecords: 0,
        totalCost: 0,
        totalPartsCost: 0,
        totalLaborCost: 0,
        averageCost: 0,
        completedCount: 0,
        inProgressCount: 0,
        scheduledCount: 0,
        serviceTypeBreakdown: {},
        statusBreakdown: {},
        monthlyBreakdown: {},
        mechanicBreakdown: {},
        vehicleBreakdown: {}
      }
    })
  }
}