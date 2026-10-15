import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { cleanJobCardPayload } from '@/lib/job-card-validation'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'read')
    const [jobCards, settings] = await Promise.all([db.workshopJobCard.findMany({
      include: {
        truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
        trailer: { select: { id: true, number: true } }
      },
      orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
      take: 500
    }), db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } })])
    return NextResponse.json({ jobCards, company: settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch job cards'
    return NextResponse.json({ error: message }, { status: message.includes('token') ? 401 : message === 'Insufficient permissions' ? 403 : 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'maintenance', 'create')
    const data = cleanJobCardPayload(await request.json())
    const vehicleExists = data.truckId
      ? await db.truck.findFirst({ where: { id: data.truckId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
      : await db.trailer.findFirst({ where: { id: data.trailerId!, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
    if (!vehicleExists) return NextResponse.json({ error: 'Selected vehicle was not found or is inactive' }, { status: 400 })

    const year = data.serviceDate.getFullYear()
    const prefix = `JC-${year}-`
    const jobCard = await db.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`
      const count = await tx.workshopJobCard.count({ where: { jobNumber: { startsWith: prefix } } })
      return tx.workshopJobCard.create({
        data: { ...data, jobNumber: `${prefix}${String(count + 1).padStart(4, '0')}`, createdById: user.id },
        include: {
          truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
          trailer: { select: { id: true, number: true } }
        }
      })
    })
    return NextResponse.json({ jobCard }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create job card'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : message.startsWith('Select ') || message.startsWith('Enter ') || message.startsWith('Service ') ? 400 : 500
    console.error('Job card create error:', error)
    return NextResponse.json({ error: status === 500 ? 'Failed to create job card' : message }, { status })
  }
}
