import { NextRequest, NextResponse } from 'next/server'
import { advancedEmailService } from '@/lib/advanced-email-service'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const { to, truckId, maintenanceType, dueDate, urgency } = await request.json()

    if (!to || !truckId || !maintenanceType || !dueDate || !urgency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const result = await advancedEmailService.sendMaintenanceAlert({
      to, truckId, maintenanceType, dueDate, urgency
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
