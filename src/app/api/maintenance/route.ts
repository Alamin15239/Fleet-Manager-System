import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      records: [],
      pagination: { page: 1, limit: 100, total: 0, pages: 0 },
      summary: { totalCost: 0, completedCount: 0, inProgressCount: 0, scheduledCount: 0 }
    })
  } catch (error) {
    return NextResponse.json({
      success: true,
      records: [],
      pagination: { page: 1, limit: 100, total: 0, pages: 0 },
      summary: { totalCost: 0, completedCount: 0, inProgressCount: 0, scheduledCount: 0 }
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return NextResponse.json({ id: 'temp', message: 'Maintenance feature coming soon' })
  } catch (error) {
    return NextResponse.json({ error: 'Maintenance feature coming soon' }, { status: 200 })
  }
}