import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
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
    return NextResponse.json(
      { error: 'Failed to fetch maintenance jobs' },
      { status: 500 }
    )
  }
}