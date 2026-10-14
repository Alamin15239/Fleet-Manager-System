import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { cleanJobCardPayload } from '@/lib/job-card-validation'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request)
    const { id } = await params
    const data = cleanJobCardPayload(await request.json())
    const vehicleExists = data.truckId
      ? await db.truck.findFirst({ where: { id: data.truckId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
      : await db.trailer.findFirst({ where: { id: data.trailerId!, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
    if (!vehicleExists) return NextResponse.json({ error: 'Selected vehicle was not found or is inactive' }, { status: 400 })
    const jobCard = await db.workshopJobCard.update({
      where: { id },
      data,
      include: {
        truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true, currentMileage: true } },
        trailer: { select: { id: true, number: true } }
      }
    })
    return NextResponse.json({ jobCard })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update job card'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message.startsWith('Select ') || message.startsWith('Enter ') || message.startsWith('Service ') ? 400 : 500
    console.error('Job card update error:', error)
    return NextResponse.json({ error: status === 500 ? 'Failed to update job card' : message }, { status })
  }
}
