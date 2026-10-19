import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'reports', 'read')
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const serviceType = searchParams.get('serviceType')
    const truckId = searchParams.get('truckId')
    const truckIds = [...new Set([...searchParams.getAll('truckIds'), ...(truckId ? [truckId] : [])].flatMap(value => value.split(',')).filter(Boolean))]
    const trailerIds = [...new Set([...searchParams.getAll('trailerIds')].flatMap(value => value.split(',')).filter(Boolean))]
    const mechanicId = searchParams.get('mechanicId')

    const parsedStartDate = startDate ? new Date(startDate) : null
    const parsedEndDate = endDate ? new Date(endDate) : null
    if ((parsedStartDate && Number.isNaN(parsedStartDate.getTime())) || (parsedEndDate && Number.isNaN(parsedEndDate.getTime()))) {
      return NextResponse.json({ success: false, error: 'Start and end dates must be valid dates.' }, { status: 400 })
    }
    if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
      return NextResponse.json({ success: false, error: 'Start date must be on or before the end date.' }, { status: 400 })
    }

    const whereClause: any = {
      isDeleted: false
    }

    if (startDate) {
      whereClause.datePerformed = { gte: parsedStartDate! }
    }

    if (endDate) {
      const inclusiveEndDate = parsedEndDate!
      inclusiveEndDate.setHours(23, 59, 59, 999)
      whereClause.datePerformed = {
        ...(whereClause.datePerformed || {}),
        lte: inclusiveEndDate
      }
    }

    if (status && status !== 'all' && status !== 'OPEN') {
      whereClause.status = status
    }

    if (serviceType && serviceType !== 'all') {
      whereClause.serviceType = { contains: serviceType, mode: 'insensitive' }
    }

    if (mechanicId) {
      whereClause.mechanicId = mechanicId
    }

    const truckWhere: any = { ...whereClause }
    const trailerWhere: any = { ...whereClause }
    if (status === 'OPEN') {
      truckWhere.id = '__no_open_truck_maintenance_records__'
      trailerWhere.id = '__no_open_trailer_maintenance_records__'
    }
    if (search) {
      truckWhere.OR = [
        { serviceType: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { truck: { licensePlate: { contains: search, mode: 'insensitive' } } },
        { truck: { make: { contains: search, mode: 'insensitive' } } },
        { truck: { model: { contains: search, mode: 'insensitive' } } }
      ]
      trailerWhere.OR = [
        { serviceType: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { trailer: { number: { contains: search, mode: 'insensitive' } } }
      ]
    }
    if (truckIds.length === 1) truckWhere.truckId = truckIds[0]
    else if (truckIds.length > 1) truckWhere.truckId = { in: truckIds }
    else if (trailerIds.length) truckWhere.id = '__no_matching_truck_records__'
    if (trailerIds.length === 1) trailerWhere.trailerId = trailerIds[0]
    else if (trailerIds.length > 1) trailerWhere.trailerId = { in: trailerIds }
    else if (truckIds.length) trailerWhere.id = '__no_matching_trailer_records__'

    const selectedMechanic = mechanicId
      ? await db.mechanic.findUnique({ where: { id: mechanicId }, select: { name: true } })
      : null
    const jobCardWhere: any = {}
    if (parsedStartDate) jobCardWhere.serviceDate = { gte: parsedStartDate }
    if (parsedEndDate) {
      const inclusiveEndDate = new Date(parsedEndDate)
      inclusiveEndDate.setHours(23, 59, 59, 999)
      jobCardWhere.serviceDate = { ...(jobCardWhere.serviceDate || {}), lte: inclusiveEndDate }
    }
    if (status) jobCardWhere.status = status
    if (serviceType && serviceType !== 'all') jobCardWhere.serviceType = { contains: serviceType, mode: 'insensitive' }
    if (mechanicId) {
      if (selectedMechanic) jobCardWhere.technicianName = { contains: selectedMechanic.name, mode: 'insensitive' }
      else jobCardWhere.id = '__no_matching_job_cards__'
    }
    if (search) {
      jobCardWhere.OR = [
        { jobNumber: { contains: search, mode: 'insensitive' } },
        { serviceType: { contains: search, mode: 'insensitive' } },
        { reportedIssue: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } },
        { technicianName: { contains: search, mode: 'insensitive' } },
        { truck: { licensePlate: { contains: search, mode: 'insensitive' } } },
        { truck: { make: { contains: search, mode: 'insensitive' } } },
        { truck: { model: { contains: search, mode: 'insensitive' } } },
        { trailer: { number: { contains: search, mode: 'insensitive' } } }
      ]
    }
    const selectedVehicles = [
      ...(truckIds.length ? [{ truckId: truckIds.length === 1 ? truckIds[0] : { in: truckIds } }] : []),
      ...(trailerIds.length ? [{ trailerId: trailerIds.length === 1 ? trailerIds[0] : { in: trailerIds } }] : [])
    ]
    if (selectedVehicles.length) jobCardWhere.AND = [{ OR: selectedVehicles }]

    const [truckRecords, trailerRecords, workshopJobCards] = await Promise.all([
      db.maintenanceRecord.findMany({
        where: truckWhere,
        select: {
          id: true,
          truckId: true,
          serviceType: true,
          description: true,
          datePerformed: true,
          partsCost: true,
          laborCost: true,
          totalCost: true,
          status: true,
          currentMileage: true,
          oilQuantityLiters: true,
          isOilChange: true,
          driverName: true,
          mechanicName: true,
          notes: true,
          truck: {
            select: {
              id: true,
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
          }
        },
        orderBy: { datePerformed: 'desc' }
      }),
      db.trailerMaintenanceRecord.findMany({
        where: trailerWhere,
        select: {
          id: true,
          trailerId: true,
          serviceType: true,
          description: true,
          datePerformed: true,
          partsCost: true,
          laborCost: true,
          totalCost: true,
          status: true,
          driverName: true,
          mechanicName: true,
          notes: true,
          trailer: { select: { id: true, number: true, driverName: true } },
          mechanic: { select: { id: true, name: true, specialty: true } }
        },
        orderBy: { datePerformed: 'desc' }
      }),
      db.workshopJobCard.findMany({
        where: jobCardWhere,
        select: {
          id: true,
          jobNumber: true,
          truckId: true,
          trailerId: true,
          serviceDate: true,
          odometerKm: true,
          serviceType: true,
          reportedIssue: true,
          status: true,
          partsCost: true,
          laborCost: true,
          totalCost: true,
          notes: true,
          driverName: true,
          technicianName: true,
          truck: { select: { id: true, make: true, model: true, year: true, licensePlate: true, currentMileage: true, driverName: true } },
          trailer: { select: { id: true, number: true, driverName: true } }
        },
        orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }]
      })
    ])

    const records = [
      ...truckRecords.map(record => ({ ...record, trailer: undefined, vehicleType: 'truck' as const })),
      ...trailerRecords.map(record => ({ ...record, truck: undefined, vehicleType: 'trailer' as const })),
      ...workshopJobCards.map(card => ({
        id: `job-card:${card.id}`,
        truckId: card.truckId,
        trailerId: card.trailerId,
        serviceType: `Job Card · ${card.serviceType}`,
        description: [card.jobNumber, card.reportedIssue || card.notes].filter(Boolean).join(' · ') || null,
        datePerformed: card.serviceDate,
        partsCost: card.partsCost,
        laborCost: card.laborCost,
        totalCost: card.totalCost,
        currentMileage: card.odometerKm ?? undefined,
        status: card.status,
        driverName: card.driverName ?? undefined,
        mechanicName: card.technicianName ?? undefined,
        technicianName: card.technicianName,
        mechanic: undefined,
        mechanicId: null,
        jobNumber: card.jobNumber,
        truck: card.truck ?? undefined,
        trailer: card.trailer ?? undefined,
        vehicleType: card.trailerId ? 'trailer' as const : 'truck' as const
      }))
    ].sort((a, b) => new Date(b.datePerformed).getTime() - new Date(a.datePerformed).getTime())
    const totalCount = records.length

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
        : record.trailer ? `Trailer ${record.trailer.number}` : 'Unknown Vehicle'
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
        openCount: records.filter(r => r.status === 'OPEN').length,
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
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    return NextResponse.json({
      success: false,
      error: 'Unable to load maintenance report data. Please try again.',
      data: [],
      summary: {
        totalRecords: 0,
        totalCost: 0,
        totalPartsCost: 0,
        totalLaborCost: 0,
        averageCost: 0,
        completedCount: 0,
        openCount: 0,
        inProgressCount: 0,
        scheduledCount: 0,
        serviceTypeBreakdown: {},
        statusBreakdown: {},
        monthlyBreakdown: {},
        mechanicBreakdown: {},
        vehicleBreakdown: {}
      }
    }, { status: unauthorized ? 401 : forbidden ? 403 : 500 })
  }
}
