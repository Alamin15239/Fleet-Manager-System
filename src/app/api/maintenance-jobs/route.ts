import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'read')
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    
    let where: any = {
      isActive: true
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { parts: { contains: search } },
        { notes: { contains: search } }
      ]
    }
    
    if (category) {
      where.category = { contains: category }
    }
    
    const jobs = await db.maintenanceJob.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })
    
    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Error fetching maintenance jobs:', error)
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json(
      { error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : 'Failed to fetch maintenance jobs' },
      { status }
    )
  }
}
