import { NextRequest, NextResponse } from 'next/server'
import { requireRolePermission } from '@/lib/permission-middleware'

// Activity modules now link to the vehicle's open Job Card as each record is saved.
// Keep this route as a successful compatibility response for older clients.
export async function POST(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'update')
    return NextResponse.json({
      success: true,
      message: 'Automatic Job Card linking is handled when each maintenance activity is saved. No manual reconciliation is required.'
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process request'
    return NextResponse.json({ error: message }, {
      status: ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    })
  }
}
