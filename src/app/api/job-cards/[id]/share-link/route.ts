import { NextRequest, NextResponse } from 'next/server'
import { requireRolePermission } from '@/lib/permission-middleware'
import { db } from '@/lib/db'
import { createJobCardShareToken } from '@/lib/job-card-share'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRolePermission(request, 'maintenance', 'read')
    const { id } = await context.params
    const jobCard = await db.workshopJobCard.findUnique({ where: { id }, select: { id: true } })
    if (!jobCard) return NextResponse.json({ error: 'Job card not found' }, { status: 404 })

    const token = createJobCardShareToken(id)
    const shareUrl = new URL(`/share/job-cards/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, request.nextUrl.origin).toString()
    return NextResponse.json({ shareUrl }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create a job-card share link'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Unable to create a job-card share link' : message }, { status })
  }
}
