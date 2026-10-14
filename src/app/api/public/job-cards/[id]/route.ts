import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyJobCardShareToken } from '@/lib/job-card-share'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = request.nextUrl.searchParams.get('token') || ''
  if (!verifyJobCardShareToken(id, token)) {
    return NextResponse.json({ error: 'This job-card link is invalid' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const [jobCard, company] = await Promise.all([
      db.workshopJobCard.findUnique({
        where: { id },
        select: {
          id: true,
          jobNumber: true,
          truckId: true,
          trailerId: true,
          serviceDate: true,
          odometerKm: true,
          serviceType: true,
          priority: true,
          reportedIssue: true,
          technicianName: true,
          driverName: true,
          status: true,
          nextServiceOdometer: true,
          nextServiceDate: true,
          notes: true,
          items: true,
          checklist: true,
          technicianSignature: true,
          supervisorSignature: true,
          driverSignature: true,
          truck: { select: { id: true, make: true, model: true, year: true, vin: true, licensePlate: true } },
          trailer: { select: { id: true, number: true } }
        }
      }),
      db.settings.findFirst({ select: { companyName: true, companyAddress: true, companyPhone: true, companyEmail: true } })
    ])

    if (!jobCard) return NextResponse.json({ error: 'Job card not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ jobCard, company }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Public job-card lookup error:', error)
    return NextResponse.json({ error: 'Unable to load this job card' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
