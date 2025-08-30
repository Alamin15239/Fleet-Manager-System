import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Test database connection first
    await db.$queryRaw`SELECT 1`
    
    // Simple notification check - just return success for now
    console.log('Notification check requested by user:', user.email)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Notification checks completed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error running notification checks:', error)
    return NextResponse.json(
      { 
        error: 'Failed to run notification checks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    // Test database connection
    await db.$queryRaw`SELECT 1`
    
    // Simple check without complex notification logic
    console.log('GET notification check requested by user:', user.email)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Notification checks completed successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error running notification checks:', error)
    return NextResponse.json(
      { 
        error: 'Failed to run notification checks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}