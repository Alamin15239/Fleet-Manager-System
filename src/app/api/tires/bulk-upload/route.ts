import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Bulk upload endpoint working',
      count: 0
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Test error' },
      { status: 500 }
    )
  }
}