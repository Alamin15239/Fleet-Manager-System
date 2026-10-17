import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { trackAPIActivity } from '@/lib/activity-middleware'

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'purchase-invoices', 'create')
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const vatRegistration = typeof body.vatRegistration === 'string' ? body.vatRegistration.trim() : ''
    if (!name) return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 })

    const vendor = await db.vendor.create({
      data: {
        name,
        vatRegistration: vatRegistration || null,
        phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
        email: typeof body.email === 'string' ? body.email.trim() || null : null,
        address: typeof body.address === 'string' ? body.address.trim() || null : null,
        notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
      },
    })
    await trackAPIActivity(request, 'VENDOR_CREATE', 'VENDOR', vendor.id, vendor.name, undefined, { createdById: user.id })
    return NextResponse.json({ success: true, vendor }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    if ((error as any)?.code === 'P2002') return NextResponse.json({ error: 'This VAT registration number is already assigned to another vendor' }, { status: 409 })
    console.error('Vendor creation failed:', error)
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : 'Failed to create vendor' }, { status })
  }
}
