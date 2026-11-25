import { NextRequest, NextResponse } from 'next/server'
import { requireRolePermission } from '@/lib/permission-middleware'

// Job Cards and operational activity modules are intentionally independent.
// This endpoint remains as a guarded compatibility response for older clients.
export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'update')
    return NextResponse.json({
      error: 'Automatic linking is disabled. Oil changes, tire events and spare-parts issues remain in their own modules and do not create or attach to Job Cards.'
    }, { status: 410 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process request'
    return NextResponse.json({ error: message }, {
      status: ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    })
  }
}
