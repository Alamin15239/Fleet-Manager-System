import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trucks', 'read')
    const search = new URL(request.url).searchParams.get('search')?.trim()
    const [fleetVehicles, trucks, trailers] = await Promise.all([db.fleetVehicle.findMany({
      where: search ? { OR: [
        { vehicleNumber: { contains: search, mode: 'insensitive' } },
        { vin: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ] } : undefined,
      include: {
        vehicleType: true,
        documents: { select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, validFrom: true, validUntil: true, reminderStartDate: true, notes: true, createdAt: true } },
      },
      orderBy: { vehicleNumber: 'asc' },
    }), db.truck.findMany({
      where: { isDeleted: false, ...(search ? { OR: [
        { licensePlate: { contains: search, mode: 'insensitive' } },
        { vin: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ] } : {}) },
      select: { id: true, licensePlate: true, vin: true, make: true, model: true, year: true, currentMileage: true, engineHours: true, driverName: true, status: true, vehicleDocuments: { select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, validFrom: true, validUntil: true, reminderStartDate: true, notes: true, createdAt: true } } },
      orderBy: { licensePlate: 'asc' },
    }), db.trailer.findMany({
      where: { isDeleted: false, ...(search ? { OR: [
        { number: { contains: search, mode: 'insensitive' } },
        { driverName: { contains: search, mode: 'insensitive' } },
      ] } : {}) },
      select: { id: true, number: true, driverName: true, status: true, vehicleDocuments: { select: { id: true, title: true, documentType: true, fileName: true, mimeType: true, fileSize: true, validFrom: true, validUntil: true, reminderStartDate: true, notes: true, createdAt: true } } },
      orderBy: { number: 'asc' },
    })])
    const legacyVehicles = [
      ...trucks.map(truck => ({ id: truck.id, sourceType: 'TRUCK', vehicleNumber: truck.licensePlate, vehicleTypeId: '', vehicleType: { id: 'legacy-truck', name: 'Truck' }, vin: truck.vin, registrationNo: null, make: truck.make, model: truck.model, year: truck.year, currentMileage: truck.currentMileage, engineHours: truck.engineHours, driverName: truck.driverName, status: truck.status, documents: truck.vehicleDocuments })),
      ...trailers.map(trailer => ({ id: trailer.id, sourceType: 'TRAILER', vehicleNumber: trailer.number, vehicleTypeId: '', vehicleType: { id: 'legacy-trailer', name: 'Trailer' }, vin: null, registrationNo: null, make: null, model: null, year: null, currentMileage: null, engineHours: null, driverName: trailer.driverName, status: trailer.status, documents: trailer.vehicleDocuments })),
    ]
    return NextResponse.json({ fleetVehicles, legacyVehicles })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not load vehicle master records' : 'Access denied' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'trucks', 'create')
    const body = await request.json()
    const vehicleNumber = String(body.vehicleNumber || '').trim()
    const vehicleTypeId = String(body.vehicleTypeId || '').trim()
    if (!vehicleNumber || vehicleNumber.length > 60 || !vehicleTypeId) {
      return NextResponse.json({ error: 'Vehicle number and vehicle type are required.' }, { status: 400 })
    }
    const type = await db.vehicleType.findUnique({ where: { id: vehicleTypeId } })
    if (!type || !type.isActive) return NextResponse.json({ error: 'Select an active vehicle type.' }, { status: 400 })
    const year = body.year === '' || body.year == null ? null : Number(body.year)
    const currentMileage = body.currentMileage === '' || body.currentMileage == null ? null : Number(body.currentMileage)
    const engineHours = body.engineHours === '' || body.engineHours == null ? null : Number(body.engineHours)
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 2)) return NextResponse.json({ error: 'Enter a valid model year.' }, { status: 400 })
    if ([currentMileage, engineHours].some(value => value !== null && (!Number.isInteger(value) || value < 0))) return NextResponse.json({ error: 'Mileage and engine hours must be non-negative whole numbers.' }, { status: 400 })

    const fleetVehicle = await db.fleetVehicle.create({ data: {
      vehicleNumber,
      vehicleTypeId,
      vin: String(body.vin || '').trim() || null,
      registrationNo: String(body.registrationNo || '').trim() || null,
      make: String(body.make || '').trim() || null,
      model: String(body.model || '').trim() || null,
      year,
      currentMileage,
      engineHours,
      driverName: String(body.driverName || '').trim() || null,
      status: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'].includes(body.status) ? body.status : 'ACTIVE',
      notes: String(body.notes || '').trim() || null,
    } })
    return NextResponse.json({ fleetVehicle }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Could not save vehicle. Check that its vehicle number and VIN are unique.' : 'Access denied' }, { status })
  }
}
